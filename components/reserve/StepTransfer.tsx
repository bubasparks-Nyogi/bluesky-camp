'use client'
import type { ReservationFormData } from '@/types/reservation'
interface Props { form: ReservationFormData; onChange: (u: Partial<ReservationFormData>) => void; onNext: () => void; onBack: () => void }
export default function StepTransfer({ form, onChange, onNext, onBack }: Props) {
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-2">送迎サービス</h3>
      <p className="text-warm-400 text-sm mb-6">最寄り駅からの送迎（¥1,000/名）</p>
      <div className="mb-4">
        <label className="block text-sm text-warm-500 mb-2">送迎人数</label>
        <div className="flex gap-1 sm:gap-2">
          {[0,1,2,3,4].map(n => (
            <button key={n} onClick={() => onChange({ transferCount: n, transferStation: n === 0 ? '' : form.transferStation })}
              className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs sm:text-sm transition-colors ${form.transferCount === n ? 'border-warm-300 bg-warm-100 text-warm-600' : 'border-warm-100 text-warm-400 hover:border-warm-200'}`}>
              {n === 0 ? 'なし' : `${n}名`}
            </button>
          ))}
        </div>
      </div>
      {form.transferCount > 0 && (
        <div><label className="block text-sm text-warm-500 mb-2">乗車駅</label>
          <input type="text" placeholder="例：近江高島駅" value={form.transferStation}
            onChange={e => onChange({ transferStation: e.target.value })}
            className="w-full border border-warm-200 rounded-lg px-4 py-3 text-warm-700 focus:outline-none focus:border-warm-400 text-base" /></div>
      )}
      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={onNext} disabled={form.transferCount > 0 && !form.transferStation}
          className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors text-base">次へ →</button>
      </div>
    </div>
  )
}
