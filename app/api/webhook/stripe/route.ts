// app/api/webhook/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/payment'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReservationConfirmedEmail } from '@/lib/email'
import { sendOwnerLineNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const sig     = req.headers.get('stripe-signature') ?? ''

  let event
  try {
    event = constructWebhookEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string }

    // status を confirmed に更新し、メール送信に必要な全フィールドを取得
    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'confirmed' })
      .eq('stripe_payment_id', pi.id)
      .select('id, guest_name, guest_email, guest_phone, checkin_date, checkout_date, stay_type, stay_types, sauna, pet, ehu, transfer_count, transfer_station, total_amount')
      .single()

    if (reservation) {
      // 確定メール送信（ベストエフォート）
      sendReservationConfirmedEmail(reservation).catch(console.error)
      // オーナーへ LINE 通知（ベストエフォート）
      sendOwnerLineNotification(reservation).catch(console.error)
    }
  }

  return NextResponse.json({ received: true })
}
