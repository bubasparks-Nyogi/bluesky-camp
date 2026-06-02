import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { postReservationEntry } from '@/lib/accounting/serverPosting'
import type { ReservationForPosting, PaymentMethod } from '@/lib/accounting/reservationPosting'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reservationId?: string; phase?: 'prepayment' | 'revenue' }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { reservationId, phase } = body
  if (!reservationId || (phase !== 'prepayment' && phase !== 'revenue'))
    return NextResponse.json({ error: 'reservationId と phase が必要です' }, { status: 400 })

  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('id, total_amount, payment_method, checkin_date, checkout_date, paid_at')
    .eq('id', reservationId).maybeSingle()
  if (!r) return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
  if (r.payment_method !== 'onsite' && r.payment_method !== 'prepaid')
    return NextResponse.json({ error: '支払方法が未設定です' }, { status: 400 })

  const reservation: ReservationForPosting = {
    id: r.id, totalAmount: r.total_amount, paymentMethod: r.payment_method as PaymentMethod,
    checkinDate: r.checkin_date, checkoutDate: r.checkout_date,
  }
  const result = await postReservationEntry(reservation, phase, { paidAt: r.paid_at ?? undefined })
  if (result.status === 'error') return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}
