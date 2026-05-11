import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/payment'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReservationNotifications } from '@/lib/notifications'

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

    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'confirmed' })
      .eq('stripe_payment_id', pi.id)
      .select()
      .single()

    if (reservation) {
      await sendReservationNotifications(reservation)
    }
  }

  return NextResponse.json({ received: true })
}
