import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { postReservationEntry } from '@/lib/accounting/serverPosting'
import type { ReservationForPosting } from '@/lib/accounting/reservationPosting'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { payment_method?: string; paid_at?: string | null }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (body.payment_method !== undefined) {
    if (body.payment_method !== 'onsite' && body.payment_method !== 'prepaid' && body.payment_method !== null)
      return NextResponse.json({ error: 'payment_method が不正です' }, { status: 400 })
    update.payment_method = body.payment_method
  }
  if (body.paid_at !== undefined) update.paid_at = body.paid_at || null
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })

  const { error: upErr } = await supabaseAdmin.from('reservations').update(update).eq('id', params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('id, total_amount, payment_method, checkin_date, checkout_date, paid_at')
    .eq('id', params.id).maybeSingle()

  if (r && r.payment_method === 'prepaid' && r.paid_at) {
    const reservation: ReservationForPosting = {
      id: r.id, totalAmount: r.total_amount, paymentMethod: 'prepaid',
      checkinDate: r.checkin_date, checkoutDate: r.checkout_date,
    }
    const result = await postReservationEntry(reservation, 'prepayment', { paidAt: r.paid_at })
    if (result.status === 'error')
      // 予約情報は保存済み。仕訳生成のみ失敗（冪等なので後から再実行で復旧可能）→ 部分成功として通知
      return NextResponse.json({ ok: true, postingError: result.error }, { status: 200 })
  }
  return NextResponse.json({ ok: true })
}
