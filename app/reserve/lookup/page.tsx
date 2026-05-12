// app/reserve/lookup/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ReservationLookupPage() {
  const router = useRouter()
  const [reservationId, setReservationId] = useState('')
  const [email,         setEmail]         = useState('')
  const [error,         setError]         = useState<string | null>(null)
  const [loading,       setLoading]       = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch(
      `/api/reservations/lookup?id=${encodeURIComponent(reservationId.trim())}&email=${encodeURIComponent(email.trim())}`,
    )
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? '予約が見つかりませんでした')
      return
    }

    router.push(`/reserve/lookup/${data.reservation.id}`)
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-warm-600 text-white py-4 px-6 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">予約確認</span>
      </header>

      <main className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="font-serif text-xl text-warm-600 font-bold mb-2 text-center">
            予約を確認する
          </h1>
          <p className="text-warm-400 text-sm text-center mb-8">
            予約完了メールに記載の予約番号とメールアドレスを入力してください
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-warm-500 mb-1">
                予約番号（先頭8文字）
              </label>
              <input
                type="text"
                required
                value={reservationId}
                onChange={e => setReservationId(e.target.value.toUpperCase())}
                placeholder="例：A1B2C3D4"
                maxLength={8}
                className="w-full border border-warm-200 rounded-lg px-4 py-3
                           text-warm-700 focus:outline-none focus:border-warm-400
                           text-base tracking-widest font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-warm-500 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="例：taro@example.com"
                className="w-full border border-warm-200 rounded-lg px-4 py-3
                           text-warm-700 focus:outline-none focus:border-warm-400 text-base"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-warm-300 hover:bg-warm-400 disabled:opacity-60
                         text-white font-bold py-3 rounded-lg transition-colors text-base"
            >
              {loading ? '検索中...' : '予約を確認する'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
