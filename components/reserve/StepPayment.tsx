'use client'
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { ReservationFormData } from '@/types/reservation'
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
interface Props { form: ReservationFormData; onBack: () => void }
export default function StepPayment({ form, onBack }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const initPayment = async () => {
    setLoading(true)
    const res = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setInitError(data.error); setLoading(false); return }
    setClientSecret(data.clientSecret); setReservationId(data.reservationId); setLoading(false)
  }
  if (!clientSecret) return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">決済</h3>
      {initError && <p className="text-red-500 text-sm mb-4">{initError}</p>}
      <p className="text-warm-500 text-sm mb-8">「決済画面へ進む」を押すとStripe決済画面が表示されます。</p>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={initPayment} disabled={loading} className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors text-base">{loading ? '準備中...' : '決済画面へ進む'}</button>
      </div>
    </div>
  )
  return <Elements stripe={stripePromise} options={{ clientSecret, locale: 'ja' }}><PaymentForm reservationId={reservationId!} onBack={onBack} /></Elements>
}
function PaymentForm({ reservationId, onBack }: { reservationId: string; onBack: () => void }) {
  const stripe = useStripe(); const elements = useElements()
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!stripe || !elements) return; setLoading(true)
    const { error: err } = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/reserve/complete?id=${reservationId}` } })
    if (err) { setError(err.message ?? '決済に失敗しました'); setLoading(false) }
  }
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">決済情報を入力</h3>
      <PaymentElement className="mb-6" />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button type="submit" disabled={loading || !stripe} className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors text-base">{loading ? '処理中...' : '支払いを確定する'}</button>
      </div>
    </form>
  )
}
