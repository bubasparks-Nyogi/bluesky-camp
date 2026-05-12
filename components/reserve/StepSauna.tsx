'use client'
import type { ReservationFormData } from '@/types/reservation'
interface Props { form: ReservationFormData; onChange: (u: Partial<ReservationFormData>) => void; onNext: () => void; onBack: () => void }
export default function StepSauna({ form, onChange, onNext, onBack }: Props) {
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">サウナ利用</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {[{ value: true, label: '利用する', desc: '無料', icon: '🧖' }, { value: false, label: '利用しない', desc: '', icon: '✕' }].map(opt => (
          <button key={String(opt.value)} onClick={() => onChange({ sauna: opt.value })}
            className={`p-5 rounded-xl border-2 text-center transition-colors ${form.sauna === opt.value ? 'border-warm-300 bg-warm-100' : 'border-warm-100 bg-white hover:border-warm-200'}`}>
            <div className="text-3xl mb-2">{opt.icon}</div>
            <div className="font-bold text-warm-600">{opt.label}</div>
            <div className="text-warm-400 text-sm mt-1">{opt.desc}</div>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={onNext} className="flex-1 bg-warm-300 hover:bg-warm-400 text-white font-bold py-3 rounded-lg transition-colors text-base">次へ →</button>
      </div>
    </div>
  )
}
