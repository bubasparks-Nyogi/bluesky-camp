import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchReservation } from '@/lib/receipt/lookup'

export async function POST(req: NextRequest) {
  let body: { reservationId?: string; email?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { reservationId, email } = body
  if (!reservationId || !email)
    return NextResponse.json({ error: '予約番号とメールアドレスが必要です' }, { status: 400 })

  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('id, guest_email, guest_name, checkin_date, checkout_date')
    .eq('id', reservationId).maybeSingle()
  if (!r || !matchReservation(reservationId, email, r))
    return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })

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
