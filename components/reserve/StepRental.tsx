'use client'
import { useState, useEffect } from 'react'
import type { ReservationFormData, RentalItem } from '@/types/reservation'
interface Props { form: ReservationFormData; onChange: (u: Partial<ReservationFormData>) => void; onNext: () => void; onBack: () => void }
export default function StepRental({ form, onChange, onNext, onBack }: Props) {
  const [items, setItems] = useState<RentalItem[]>([])
  useEffect(() => { fetch('/api/rental-items').then(r => r.json()).then(d => setItems(d.items ?? [])) }, [])
  const getQty = (id: string) => form.rentalItems.find(r => r.id === id)?.qty ?? 0
  const setQty = (item: RentalItem, qty: number) => {
    const rest = form.rentalItems.filter(r => r.id !== item.id)
    onChange({ rentalItems: qty > 0 ? [...rest, { id: item.id, name: item.name, price: item.pricePerDay, qty }] : rest })
  }
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-2">道具レンタル</h3>
      <p className="text-warm-400 text-sm mb-6">必要な道具を選んでください（1泊あたり）</p>
      <div className="space-y-3 mb-8">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-4 bg-warm-50 rounded-xl">
            <div><div className="font-bold text-warm-600 text-sm">{item.name}</div><div className="text-warm-400 text-xs">¥{item.pricePerDay.toLocaleString()}/泊</div></div>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty(item, Math.max(0, getQty(item.id) - 1))} className="w-8 h-8 rounded-full bg-warm-200 text-warm-600 font-bold text-lg flex items-center justify-center">−</button>
              <span className="w-6 text-center font-bold text-warm-600">{getQty(item.id)}</span>
              <button onClick={() => setQty(item, getQty(item.id) + 1)} className="w-8 h-8 rounded-full bg-warm-300 text-white font-bold text-lg flex items-center justify-center">+</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-warm-400 py-4">読み込み中...</p>}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={onNext} className="flex-1 bg-warm-300 hover:bg-warm-400 text-white font-bold py-3 rounded-lg transition-colors text-base">次へ →</button>
      </div>
    </div>
  )
}
