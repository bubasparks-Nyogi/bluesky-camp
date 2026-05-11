'use client'
import type { ReservationFormData, StayType } from '@/types/reservation'
interface Props { form: ReservationFormData; onChange: (u: Partial<ReservationFormData>) => void; onNext: () => void; onBack: () => void }
const TYPES: Array<{ value: StayType; label: string; desc: string; icon: string }> = [
  { value: 'tent', label: 'テント設営', desc: '持ち込みテント or レンタルテント', icon: '⛺' },
  { value: 'trailer_a', label: 'トレーラーA', desc: 'キャンピングトレーラー A棟', icon: '🚌' },
  { value: 'trailer_b', label: 'トレーラーB', desc: 'キャンピングトレーラー B棟', icon: '🚌' },
  { value: 'campervan', label: 'キャンピングカー乗り入れ', desc: 'マイカーで乗り入れ（EHU対応）', icon: '🚐' },
]
export default function StepStayType({ form, onChange, onNext, onBack }: Props) {
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">宿泊タイプを選択</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {TYPES.map(t => (
          <button key={t.value} onClick={() => onChange({ stayType: t.value, ehu: false })}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${form.stayType === t.value ? 'border-warm-300 bg-warm-100' : 'border-warm-100 bg-white hover:border-warm-200'}`}>
            <div className="text-2xl mb-1">{t.icon}</div>
            <div className="font-bold text-warm-600 text-sm">{t.label}</div>
            <div className="text-warm-400 text-xs mt-1">{t.desc}</div>
          </button>
        ))}
      </div>
      {form.stayType === 'campervan' && (
        <label className="flex items-center gap-3 p-4 bg-warm-50 rounded-xl border border-warm-200 cursor-pointer mb-4">
          <input type="checkbox" checked={form.ehu} onChange={e => onChange({ ehu: e.target.checked })} className="w-5 h-5 accent-warm-300" />
          <div><div className="font-bold text-warm-600 text-sm">EHU外部電源を使用する</div><div className="text-warm-400 text-xs">+¥1,000</div></div>
        </label>
      )}
      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={onNext} disabled={!form.stayType} className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors text-base">次へ →</button>
      </div>
    </div>
  )
}
