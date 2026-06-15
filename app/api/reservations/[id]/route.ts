import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calcTotal } from '@/lib/pricing'
import { fetchPricingRules } from '@/lib/pricing/fetchRules'
import { sendReservationEmails } from '@/lib/email'
import { reservationFormSchema } from '@/lib/validation/reservation'
import type { ReservationFormData, ReservationRow, PricingItem } from '@/types/reservation'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const parsed = reservationFormSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first?.message ?? '入力内容を確認してください', field: first?.path.join('.') },
      { status: 400 },
    )
  }
  const form: ReservationFormData = parsed.data as ReservationFormData

  // 既存予約取得
  const { data: existing } = await supabaseAdmin
    .from('reservations').select('*').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
  const reservation = existing as ReservationRow
  if (reservation.status === 'cancelled')
    return NextResponse.json({ error: 'キャンセル済みの予約は変更できません' }, { status: 409 })

  // 過去日付ガード
  const today = new Date().toISOString().slice(0, 10)
  if (reservation.checkin_date < today)
    return NextResponse.json({ error: 'チェックイン日を過ぎた予約は変更できません' }, { status: 409 })
  if (form.checkinDate < today)
    return NextResponse.json({ error: '過去の日付は選択できません' }, { status: 400 })

  // 日付重複チェック（他予約と競合しないか、自分自身は除外）
  const { data: conflict } = await supabaseAdmin
    .from('reservations').select('id')
    .eq('checkin_date', form.checkinDate)
    .neq('status', 'cancelled')
    .neq('id', params.id)
    .maybeSingle()
  if (conflict)
    return NextResponse.json({ error: 'その日程はすでに別の予約が入っています' }, { status: 409 })

  // 料金再計算
  const { data: pricingRows } = await supabaseAdmin
    .from('pricing').select('*').eq('active', true)
  const pricing: PricingItem[] = (pricingRows ?? []).map((p: { item_key: string; label: string; amount: number; active: boolean }) => ({
    itemKey: p.item_key, label: p.label, amount: p.amount, active: p.active,
  }))
  let isRepeater = false
  if (reservation.user_id) {
    const { count } = await supabaseAdmin
      .from('reservations').select('*', { count: 'exact', head: true })
      .eq('user_id', reservation.user_id).neq('id', params.id)
    isRepeater = (count ?? 0) >= 1
  }
  const rules = await fetchPricingRules()
  const totalAmount = calcTotal(form, pricing, {
    isRepeater,
    multiNightDiscount: rules.multiNightDiscount,
    seasonalRates: rules.seasonalRates,
  })

  // 更新
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('reservations').update({
      checkin_date:     form.checkinDate,
      checkout_date:    form.checkoutDate,
      stay_type:        form.stayTypes[0],
      stay_types:       form.stayTypes,
      ehu:              form.ehu,
      sauna:            form.sauna,
      pet:              form.pet,
      transfer_count:   form.transferCount,
      transfer_station: form.transferStation || null,
      rental_items:     form.rentalItems,
      guest_name:       form.guestName.trim(),
      guest_email:      form.guestEmail.trim(),
      guest_phone:      form.guestPhone.trim(),
      total_amount:     totalAmount,
    })
    .eq('id', params.id).select().single()
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // 確認メール再送（best-effort）
  try {
    await sendReservationEmails(updated as ReservationRow, reservation.status === 'confirmed' ? 'confirmed' : 'pending')
  } catch (e) {
    console.error('sendReservationEmails (edit) failed:', e)
  }

  return NextResponse.json({
    reservation: updated,
    priceChanged: totalAmount !== reservation.total_amount,
    oldTotal: reservation.total_amount,
    newTotal: totalAmount,
  })
}
