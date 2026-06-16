import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifySignature } from '@/lib/line/verifySignature'
import { classifySender } from '@/lib/line/classifySender'
import { resolveActiveReservation, type ActiveReservationRow } from '@/lib/line/resolveActiveReservation'
import { trimLineEvent } from '@/lib/security/trimWebhookPayload'
import { extractSaleDrafts } from '@/lib/ai/extractSaleDrafts'
import { computeReplySuffix } from '@/lib/notifications/computeReplySuffix'
import { shouldPushOwnerAlert } from '@/lib/notifications/shouldPushOwnerAlert'

export const runtime = 'nodejs'

interface LineEvent {
  type: string
  timestamp: number
  source?: { userId?: string }
  message?: { id: string; type: string; text?: string }
  replyToken?: string
}

const REPLY_TEXT = 'メッセージありがとうございます ✨ 内容を確認してご連絡します'

async function reply(replyToken: string, text: string): Promise<void> {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    })
  } catch (e) {
    console.error('[line/webhook] reply failed', e)
  }
}

async function pushOwnerAlert(text: string): Promise<void> {
  const userId = process.env.LINE_OWNER_USER_ID
  if (!userId) return
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
    })
  } catch (e) {
    console.error('[line/webhook] push failed', e)
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const sig = req.headers.get('x-line-signature') ?? ''
  const secret = process.env.LINE_CHANNEL_SECRET ?? ''
  if (!verifySignature(raw, sig, secret))
    return new NextResponse('Unauthorized', { status: 401 })

  let payload: { events: LineEvent[] }
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ ok: true }) }

  const ownerId = process.env.LINE_OWNER_USER_ID
  const today = new Date().toISOString().slice(0, 10)

  for (const ev of payload.events ?? []) {
    if (ev.type !== 'message' || !ev.source?.userId || !ev.message) continue
    const lineUserId = ev.source.userId
    const sender = classifySender(lineUserId, ownerId)

    const { data: rows } = await supabaseAdmin
      .from('reservations')
      .select('id, checkin_date, checkout_date, created_at')
      .eq('line_user_id', lineUserId)
    const active = resolveActiveReservation(today, (rows ?? []) as ActiveReservationRow[])

    const { data: inserted } = await supabaseAdmin.from('line_messages').upsert({
      reservation_id: active?.id ?? null,
      line_user_id: lineUserId,
      line_message_id: ev.message.id,
      sender,
      message_type: ev.message.type,
      text: ev.message.type === 'text' ? (ev.message.text ?? null) : null,
      raw_event: trimLineEvent(ev),
      received_at: new Date(ev.timestamp).toISOString(),
    }, { onConflict: 'line_message_id', ignoreDuplicates: false })
      .select('id').maybeSingle()
    const sourceLineMessageId = inserted?.id ?? null

    // === B-7b: AI 抽出 ===
    if (sender === 'customer' && active && sourceLineMessageId && ev.message.type === 'text' && ev.message.text) {
      const [{ data: recentMsgs }, { data: items }] = await Promise.all([
        supabaseAdmin
          .from('line_messages').select('sender, text, received_at, message_type')
          .eq('reservation_id', active.id).eq('message_type', 'text')
          .order('received_at', { ascending: false }).limit(10),
        supabaseAdmin.from('items').select('id, name, sale_price')
          .eq('is_sellable', true).eq('is_active', true),
      ])
      const messagesForAi = (recentMsgs ?? [])
        .filter(m => m.text && (m.sender === 'customer' || m.sender === 'owner'))
        .reverse()
        .map(m => ({ sender: m.sender as 'customer' | 'owner', text: m.text as string, received_at: m.received_at }))
      const itemsForAi = (items ?? [])
        .filter(i => i.sale_price != null)
        .map(i => ({ id: i.id, name: i.name, unit_price: i.sale_price as number }))

      const extracted = await extractSaleDrafts({ items: itemsForAi, messages: messagesForAi })

      if (extracted.length > 0) {
        const occurredAt = today
        const rawExtraction = { messages: messagesForAi.length, items: itemsForAi.length, result: extracted }
        const draftsToInsert = extracted.map(e => ({
          reservation_id: active.id,
          source_line_message_id: sourceLineMessageId,
          item_id: e.itemId,
          item_name_raw: e.itemNameRaw,
          unit_price: e.unitPrice,
          quantity: e.quantity,
          occurred_at: occurredAt,
          confidence: e.confidence,
          raw_extraction: rawExtraction,
        }))
        await supabaseAdmin.from('sale_drafts').insert(draftsToInsert)
      }
    }

    // === reply with suffix + optional push ===
    if (sender === 'customer' && ev.replyToken) {
      let suffix = ''
      let pendingCount = 0
      if (active) {
        const { count } = await supabaseAdmin
          .from('sale_drafts').select('*', { count: 'exact', head: true })
          .eq('reservation_id', active.id).eq('status', 'pending')
        pendingCount = count ?? 0
        suffix = computeReplySuffix(pendingCount)
      }
      await reply(ev.replyToken, REPLY_TEXT + suffix)

      if (active && pendingCount > 0) {
        const { count: alertCount } = await supabaseAdmin
          .from('line_messages').select('*', { count: 'exact', head: true })
          .eq('reservation_id', active.id)
          .eq('sender', 'system').eq('message_type', 'owner_alert')
          .gte('received_at', `${today}T00:00:00Z`)
        const alreadyAlertedToday = (alertCount ?? 0) > 0
        if (shouldPushOwnerAlert(pendingCount, alreadyAlertedToday)) {
          await pushOwnerAlert(`@blueSky: 予約 ${active.id.slice(0, 8).toUpperCase()} の未承認登録案が ${pendingCount} 件あります`)
          await supabaseAdmin.from('line_messages').insert({
            reservation_id: active.id,
            line_user_id: 'system',
            line_message_id: null,
            sender: 'system',
            message_type: 'owner_alert',
            text: `pending=${pendingCount}`,
            raw_event: { type: 'owner_alert' },
            received_at: new Date().toISOString(),
          })
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
