'use client'
import { useState, useEffect } from 'react'
import { calcBreakdown, calcTotal } from '@/lib/pricing'
import WeatherForecast from '@/components/reserve/WeatherForecast'
import type { ReservationFormData, PricingItem } from '@/types/reservation'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}

interface Props { form: ReservationFormData; onNext: () => void; onBack: () => void }

export default function StepConfirm({ form, onNext, onBack }: Props) {
  const [pricing, setPricing] = useState<PricingItem[]>([])
  const [isRepeater, setIsRepeater] = useState(false)
  useEffect(() => {
    fetch('/api/pricing').then(r => r.json()).then(d => setPricing(d.pricing ?? []))
    fetch('/api/repeater-status')
      .then(r => r.json())
      .then(d => setIsRepeater(!!d.isRepeater))
      .catch(() => {})
  }, [])

  const breakdown = calcBreakdown(form, pricing)
  const total     = calcTotal(form, pricing, { isRepeater })

  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">内容確認</h3>
      <div className="bg-warm-50 rounded-xl p-5 space-y-2 text-sm mb-6">
        {([
          ['チェックイン',   form.checkinDate],
          ['チェックアウト', form.checkoutDate],
          ['宿泊タイプ',     (form.stayTypes ?? []).map(t => STAY_LABELS[t]).join('・') || '未選択'],
          ['お名前',         form.guestName],
          ['メール',         form.guestEmail],
          ['電話番号',       form.guestPhone],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-warm-400">{label}</span>
            <span className="text-warm-600 font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* チェックイン日の天気予報 */}
      {form.checkinDate && (
        <div className="mb-6">
          <WeatherForecast date={form.checkinDate} />
        </div>
      )}

      <div className="bg-white border border-warm-200 rounded-xl p-5 mb-6">
        <h4 className="font-bold text-warm-600 mb-3 text-sm">料金明細</h4>
        {breakdown.map((b, i) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b border-warm-100 last:border-0">
            <span className="text-warm-500">{b.label}</span>
            <span className="text-warm-600">¥{b.amount.toLocaleString()}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-warm-700 mt-3 pt-3 border-t border-warm-200">
          <span>合計</span>
          <span className="text-lg">¥{total.toLocaleString()}</span>
        </div>
        {isRepeater && (
          <p className="text-green-600 text-sm mt-2">✨ リピーター割引 10% OFF 適用中</p>
        )}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={onNext} className="flex-1 bg-warm-300 hover:bg-warm-400 text-white font-bold py-3 rounded-lg transition-colors text-base">決済へ進む →</button>
      </div>
    </div>
  )
}
