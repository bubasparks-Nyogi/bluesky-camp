import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createPaymentIntent } from '@/lib/payment'
import { calcTotal } from '@/lib/pricing'
import { sendReservationEmails } from '@/lib/email'
import { sendOwnerLineNotification } from '@/lib/notifications'
import { fetchPricingRules } from '@/lib/pricing/fetchRules'
import { reservationFormSchema } from '@/lib/validation/reservation'
import type { ReservationFormData } from '@/types/reservation'

// STRIPE_SECRET_KEY が placeholder を含む場合は決済をスキップする
const stripeEnabled = !(process.env.STRIPE_SECRET_KEY ?? '').includes('placeholder')

export async function POST(req: NextRequest) {
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

  const supabaseAuth = createSupabaseServerClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

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

  let isRepeater = false
  if (user) {
    const { count } = await supabaseAdmin
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    isRepeater = (count ?? 0) >= 1
  }

  const rules = await fetchPricingRules()
  const totalAmount = calcTotal(form, pricing, {
    isRepeater,
    multiNightDiscount: rules.multiNightDiscount,
    seasonalRates: rules.seasonalRates,
  })

  let clientSecret:    string | null = null
  let paymentIntentId: string | null = null

  if (stripeEnabled) {
    const result = await createPaymentIntent({
      amount:      totalAmount,
      currency:    'jpy',
      description: `@blueSky 予約 ${form.checkinDate}`,
      metadata:    {
        guestName:   form.guestName,
        guestEmail:  form.guestEmail,
        checkinDate: form.checkinDate,
      },
    })
    clientSecret    = result.clientSecret
    paymentIntentId = result.paymentIntentId
  }

  const { data: reservation, error } = await supabaseAdmin
    .from('reservations')
    .insert({
      checkin_date:     form.checkinDate,
      checkout_date:    form.checkoutDate,
      status:           stripeEnabled ? 'pending' : 'confirmed',
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
      user_id:            user?.id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // メール送信（ベストエフォート：失敗しても予約は成功扱い）
  // サーバーレスではレスポンス返却後に関数が凍結されるため、必ず await して送信を完了させる
  try {
    await sendReservationEmails(
      reservation,
      stripeEnabled ? 'pending' : 'confirmed',
    )
  } catch (e) {
    console.error('sendReservationEmails failed:', e)
  }

  // Stripe 未設定（即時確定）の場合のみ LINE 通知（ベストエフォート）
  if (!stripeEnabled) {
    try {
      await sendOwnerLineNotification(reservation)
    } catch (e) {
      console.error('sendOwnerLineNotification failed:', e)
    }
  }

  return NextResponse.json({ clientSecret, reservationId: reservation.id })
}
