'use client'
import type { ReservationFormData, StayType } from '@/types/reservation'

interface Props {
  form: ReservationFormData
  onChange: (u: Partial<ReservationFormData>) => void
  onNext: () => void
  onBack: () => void
}

const TYPES: Array<{ value: StayType; label: string; desc: string; icon: string }> = [
  { value: 'tent',      label: 'テント設営',           desc: '持ち込みテント or レンタルテント', icon: '⛺' },
  { value: 'trailer_a', label: 'トレーラーA',           desc: 'キャンピングトレーラー A棟',       icon: '🚌' },
  { value: 'trailer_b', label: 'トレーラーB',           desc: 'キャンピングトレーラー B棟',       icon: '🚌' },
  { value: 'campervan', label: 'キャンピングカー乗り入れ', desc: 'マイカーで乗り入れ（EHU対応）',    icon: '🚐' },
]

export default function StepStayType({ form, onChange, onNext, onBack }: Props) {
  const selected = form.stayTypes ?? []

  const toggle = (value: StayType) => {
    const next = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value]
    // キャンピングカーが外れたら EHU もリセット
    const ehu = next.includes('campervan') ? form.ehu : false
    onChange({ stayTypes: next, ehu })
  }

  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-2">宿泊タイプを選択</h3>
      <p className="text-warm-400 text-sm mb-5">複数選択可（各タイプ分の料金が加算されます）</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {TYPES.map(t => {
          const isSelected = selected.includes(t.value)
          return (
            <button key={t.value} onClick={() => toggle(t.value)}
              className={`p-4 rounded-xl border-2 text-left transition-colors relative ${
                isSelected ? 'border-warm-300 bg-warm-100' : 'border-warm-100 bg-white hover:border-warm-200'
              }`}>
              {isSelected && (
                <span className="absolute top-2 right-2 text-warm-400 text-xs font-bold bg-warm-200 rounded-full w-5 h-5 flex items-center justify-center">✓</span>
              )}
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="font-bold text-warm-600 text-sm">{t.label}</div>
              <div className="text-warm-400 text-xs mt-1">{t.desc}</div>
            </button>
          )
        })}
      </div>

      {selected.includes('campervan') && (
        <label className="flex items-center gap-3 p-4 bg-warm-50 rounded-xl border border-warm-200 cursor-pointer mb-4">
          <input type="checkbox" checked={form.ehu}
            onChange={e => onChange({ ehu: e.target.checked })}
            className="w-5 h-5 accent-warm-300" />
          <div>
            <div className="font-bold text-warm-600 text-sm">EHU外部電源を使用する</div>
            <div className="text-warm-400 text-xs">+¥1,000</div>
          </div>
        </label>
      )}

      {selected.length > 0 && (
        <div className="bg-warm-50 rounded-lg px-4 py-2 text-sm text-warm-600 mb-4 text-center">
          選択中: {selected.map(v => TYPES.find(t => t.value === v)?.label).join('・')}
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={onBack}
          className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">
          ← 戻る
        </button>
        <button onClick={onNext} disabled={selected.length === 0}
          className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors text-base">
          次へ →
        </button>
      </div>
    </div>
  )
}
