'use client'
import { useState } from 'react'

interface Receipt { type: string; sentAt: string }
interface Reservation { shortId: string; checkinDate: string; checkoutDate: string; guestName: string }
interface LookupResult { reservation: Reservation; receipts: Receipt[] }

const TYPE_LABEL: Record<string, string> = {
  receipt: '総合領収書',
  cancellation_fee: 'キャンセル料明細書',
}

export default function ReceiptLookupForm({ defaultReservationId }: { defaultReservationId: string }) {
  const [reservationId, setReservationId] = useState(defaultReservationId)
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/receipts/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, email }),
      })
      const json = await res.json()
      if (res.status === 404) { setError('予約番号またはメールアドレスが正しくありません'); return }
      if (!res.ok) { setError(json.error ?? 'エラーが発生しました'); return }
      setResult(json)
    } catch {
      setError('エラーが発生しました。時間をおいて再度お試しください')
    } finally { setLoading(false) }
  }

  const reset = () => { setResult(null); setError(null) }

  if (result) {
    const { reservation, receipts } = result
    return (
      <div className="bg-white border border-warm-100 rounded-2xl p-6 space-y-4">
        <div>
          <p className="text-warm-400 text-xs">予約番号 {reservation.shortId}</p>
          <p className="font-medium text-warm-700">{reservation.guestName} 様</p>
          <p className="text-warm-500 text-sm">{reservation.checkinDate} 〜 {reservation.checkoutDate}</p>
        </div>

        {receipts.length === 0 ? (
          <p className="text-warm-400 text-sm py-4">まだ領収書は発行されていません。チェックアウト後の発行をお待ちください。</p>
        ) : (
          <div className="space-y-3">
            {receipts.map(r => (
              <div key={r.type} className="border border-warm-100 rounded-xl p-4">
                <p className="font-medium text-warm-700">📄 {TYPE_LABEL[r.type] ?? r.type}</p>
                <p className="text-warm-400 text-xs mt-1">最終送信 {new Date(r.sentAt).toLocaleString('ja-JP')}</p>
                <a
                  href={`/api/receipts/download?id=${encodeURIComponent(reservationId)}&type=${r.type}&email=${encodeURIComponent(email)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-block bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm"
                >
                  PDFをダウンロード
                </a>
              </div>
            ))}
            <p className="text-warm-300 text-xs">※ 2回目以降のDLには「再発行」が記載されます。</p>
          </div>
        )}

        <button onClick={reset} className="text-warm-500 text-sm hover:text-warm-700">← 別の予約を検索</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white border border-warm-100 rounded-2xl p-6 space-y-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div>
        <label className="block text-sm text-warm-500 mb-1">予約番号</label>
        <input
          type="text" required
          value={reservationId}
          onChange={e => setReservationId(e.target.value)}
          placeholder="例: 12345678-..."
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm font-mono"
        />
      </div>
      <div>
        <label className="block text-sm text-warm-500 mb-1">ご登録メールアドレス</label>
        <input
          type="email" required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border border-warm-200 rounded-lg px-4 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
      </div>
      <button
        type="submit" disabled={loading}
        className="w-full bg-warm-500 hover:bg-warm-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '照合中...' : '領収書を表示'}
      </button>
    </form>
  )
}
