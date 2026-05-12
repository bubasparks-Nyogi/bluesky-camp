import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPaymentIntent } from '@/lib/payment'
import { calcTotal } from '@/lib/pricing'
import type { ReservationFormData } from '@/types/reservation'

export async function POST(req: NextRequest) {
  const form: ReservationFormData = await req.json()

  const { data: existing } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('checkin_date', form.checkinDate)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'その日程はすでに予約済みです' }, { status: 409 })
  }

  const { data: pricingRows } = await supabaseAdmin
    .from('pricing')
    .select('*')
    .eq('active', true)

  const pricing = (pricingRows ?? []).map((p: {
    item_key: string; label: string; amount: number; active: boolean
  }) => ({
    itemKey: p.item_key,
    label:   p.label,
    amount:  p.amount,
    active:  p.active,
  }))

  const totalAmount = calcTotal(form, pricing)

  const { clientSecret, paymentIntentId } = await createPaymentIntent({
    amount:      totalAmount,
    currency:    'jpy',
    description: `@blueSky 予約 ${form.checkinDate}`,
    metadata:    {
      guestName:   form.guestName,
      guestEmail:  form.guestEmail,
      checkinDate: form.checkinDate,
    },
  })

  const { data: reservation, error } = await supabaseAdmin
    .from('reservations')
    .insert({
      checkin_date:     form.checkinDate,
      checkout_date:    form.checkoutDate,
      status:           'pending',
      stay_type:        form.stayTypes?.[0] ?? 'tent',   // 後方互換
      stay_types:       form.stayTypes ?? [],             // 複数タイプ
      ehu:              form.ehu,
      sauna:            form.sauna,
      pet:              form.pet,
      transfer_count:   form.transferCount,
      transfer_station: form.transferStation || null,
      rental_items:     form.rentalItems,
      guest_name:       form.guestName,
      guest_email:      form.guestEmail,
      guest_phone:      form.guestPhone,
      total_amount:       totalAmount,
      stripe_payment_id:  paymentIntentId,
      agreed_to_terms_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ clientSecret, reservationId: reservation.id })
}
