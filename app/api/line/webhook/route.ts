import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifySignature } from '@/lib/line/verifySignature'
import { classifySender } from '@/lib/line/classifySender'
import { resolveActiveReservation, type ActiveReservationRow } from '@/lib/line/resolveActiveReservation'

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

    await supabaseAdmin.from('line_messages').upsert({
      reservation_id: active?.id ?? null,
      line_user_id: lineUserId,
      line_message_id: ev.message.id,
      sender,
      message_type: ev.message.type,
      text: ev.message.type === 'text' ? (ev.message.text ?? null) : null,
      raw_event: ev,
      received_at: new Date(ev.timestamp).toISOString(),
    }, { onConflict: 'line_message_id', ignoreDuplicates: true })

    if (sender === 'customer' && ev.replyToken)
      await reply(ev.replyToken, REPLY_TEXT)
  }

  return NextResponse.json({ ok: true })
}
