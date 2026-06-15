'use client'
import { useState } from 'react'
import type { ReservationFormData } from '@/types/reservation'

interface Props {
  form: ReservationFormData
  reservationId: string
  oldTotal: number
  onBack: () => void
}

export default function StepEditSubmit({ form, reservationId, oldTotal, onBack }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [result, setResult]   = useState<{ priceChanged: boolean; newTotal: number } | null>(null)

  const submit = async () => {
    setLoading(true); setError(null)
    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? '変更に失敗しました'); setLoading(false); return }
    setResult({ priceChanged: !!json.priceChanged, newTotal: json.newTotal as number })
    setLoading(false)
  }

  if (result) {
    return (
      <div>
        <h3 className="font-serif text-xl text-warm-700 font-bold mb-6">✅ 予約を変更しました</h3>
        {result.priceChanged && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 text-sm">
            <p className="font-bold text-warm-700">料金が変更されました</p>
            <p className="text-warm-500">変更前: ¥{oldTotal.toLocaleString()} → 変更後: ¥{result.newTotal.toLocaleString()}</p>
            <p className="text-warm-400 text-xs mt-2">
              差額の決済が必要な場合は、オーナーよりご連絡いたします。<br />
              ご不明な点は予約番号をご記載のうえお問い合わせください。
            </p>
          </div>
        )}
        <p className="text-warm-500 text-sm mb-6">変更内容の確認メールをお送りしました。</p>
        <a href={`/reserve/lookup/${reservationId}`}
          className="block bg-warm-500 hover:bg-warm-600 text-white font-bold py-3 rounded-lg text-center">
          予約詳細に戻る
        </a>
      </div>
    )
  }

  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">変更内容を確定する</h3>
      <p className="text-warm-500 text-sm mb-8">
        ここまでの入力内容で予約を更新します。確定後は変更通知メールが送信されます。
      </p>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg">← 戻る</button>
        <button onClick={submit} disabled={loading}
          className="flex-1 bg-warm-500 hover:bg-warm-600 disabled:opacity-60 text-white font-bold py-3 rounded-lg">
          {loading ? '更新中...' : '変更を確定する'}
        </button>
      </div>
    </div>
  )
}
