// components/reserve/CancelModal.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CancellationFeeResult } from '@/lib/cancellation'

interface Props {
  reservationId: string
  guestEmail:    string
  checkinDate:   string
  totalAmount:   number
  feeResult:     CancellationFeeResult
  onClose:       () => void
}

export default function CancelModal({
  reservationId, guestEmail, feeResult, onClose
}: Props) {
  const router              = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)

  const handleCancel = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/reservations/${reservationId}/cancel`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: guestEmail }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'エラーが発生しました')
      setLoading(false)
      return
    }
    setDone(true)
  }

  return (
    // done ステート中はモーダル外クリックを無効化
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      onClick={done ? undefined : onClose}
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full"
           onClick={e => e.stopPropagation()}>

        {done ? (
          /* ── 完了ステート ── */
          <>
            <div className="text-center mb-5">
              <p className="text-3xl mb-3">✅</p>
              <h3 className="font-bold text-warm-700 text-lg">キャンセルが完了しました</h3>
            </div>
            <div className="bg-warm-50 rounded-xl p-4 mb-5 text-center">
              <p className="text-sm text-warm-600 font-medium mb-1">キャンセル料</p>
              {feeResult.rate === 0 ? (
                <p className="text-xl font-bold text-green-600">無料</p>
              ) : (
                <>
                  <p className="text-xl font-bold text-red-600">
                    ¥{feeResult.fee.toLocaleString()}
                  </p>
                  <p className="text-xs text-warm-400 mt-1">（{feeResult.label}）</p>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/')}
                className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-sm"
              >
                ホームに戻る
              </button>
              <button
                onClick={() => router.push('/reserve')}
                className="flex-1 bg-warm-300 hover:bg-warm-400 text-white font-bold py-3 rounded-lg text-sm transition-colors"
              >
                新しい予約をする
              </button>
            </div>
          </>
        ) : (
          /* ── 確認ステート ── */
          <>
            <h3 className="font-bold text-warm-700 text-lg mb-4">キャンセルの確認</h3>
            <div className="bg-warm-50 rounded-xl p-4 mb-5">
              <p className="text-sm text-warm-600 font-medium mb-1">キャンセル料</p>
              {feeResult.rate === 0 ? (
                <p className="text-xl font-bold text-green-600">無料</p>
              ) : (
                <>
                  <p className="text-xl font-bold text-red-600">
                    ¥{feeResult.fee.toLocaleString()}
                  </p>
                  <p className="text-xs text-warm-400 mt-1">（{feeResult.label}）</p>
                </>
              )}
              <p className="text-xs text-warm-400 mt-3">
                ※ お支払いについては別途ご連絡します
              </p>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-sm"
              >
                戻る
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 bg-red-400 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-3 rounded-lg text-sm transition-colors"
              >
                {loading ? 'キャンセル中...' : 'キャンセルを確定する'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
