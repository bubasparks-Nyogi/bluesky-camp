import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchReservation } from '@/lib/receipt/lookup'
import { isRecentlyRateLimited, recordLookupAttempt } from '@/lib/security/rateLimit'

const WINDOW_MS = 30 * 60 * 1000   // 30 分
const FAIL_LIMIT = 5

export async function POST(req: NextRequest) {
  let body: { reservationId?: string; email?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { reservationId, email } = body
  if (!reservationId || !email)
    return NextResponse.json({ error: '予約番号とメールアドレスが必要です' }, { status: 400 })

  // S-5: ブルートフォース防止
  if (await isRecentlyRateLimited({
    table: 'receipt_lookup_attempts',
    key: reservationId,
    windowMs: WINDOW_MS,
    failLimit: FAIL_LIMIT,
  })) {
    return NextResponse.json(
      { error: '試行回数が上限に達しました。しばらく時間をおいて再度お試しください。' },
      { status: 429 },
    )
  }

  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('id, guest_email, guest_name, checkin_date, checkout_date')
    .eq('id', reservationId).maybeSingle()
  if (!r || !matchReservation(reservationId, email, r)) {
    await recordLookupAttempt({ reservationId, succeeded: false })
    return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
  }
  await recordLookupAttempt({ reservationId, succeeded: true })

  const { data: logs } = await supabaseAdmin
    .from('receipt_logs').select('type, sent_at')
    .eq('reservation_id', reservationId)
    .order('sent_at', { ascending: false })

  const latestByType = new Map<string, string>()
  for (const l of logs ?? []) {
    if (!latestByType.has(l.type)) latestByType.set(l.type, l.sent_at)
  }
  const receipts = Array.from(latestByType.entries()).map(([type, sentAt]) => ({ type, sentAt }))

  return NextResponse.json({
    reservation: {
      shortId: r.id.slice(0, 8).toUpperCase(),
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
      guestName: r.guest_name,
    },
    receipts,
  })
}
