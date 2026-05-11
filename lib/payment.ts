// lib/payment.ts
/**
 * 決済抽象化レイヤー。
 * 予約フローはこのファイルのみを呼ぶ。
 * Stripeを別会社（PAY.JP等）に替えるときはこのファイルだけ書き換える。
 */
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-04-22.dahlia' as any,
})

export interface CreatePaymentIntentInput {
  amount:      number              // 円
  currency:    string              // 'jpy'
  description: string
  metadata:    Record<string, string>
}

export interface CreatePaymentIntentResult {
  clientSecret:    string
  paymentIntentId: string
}

/** PaymentIntent を作成してクライアントシークレットを返す */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<CreatePaymentIntentResult> {
  const intent = await stripe.paymentIntents.create({
    amount:      input.amount,
    currency:    input.currency,
    description: input.description,
    metadata:    input.metadata,
    automatic_payment_methods: { enabled: true },
  })
  return {
    clientSecret:    intent.client_secret!,
    paymentIntentId: intent.id,
  }
}

/** Stripe Webhookのシグネチャ検証 */
export function constructWebhookEvent(
  payload: string | Buffer,
  sig:     string,
  secret:  string,
) {
  return stripe.webhooks.constructEvent(payload, sig, secret)
}
