'use client'
import type { ReservationFormData } from '@/types/reservation'
interface Props { form: ReservationFormData; onChange: (u: Partial<ReservationFormData>) => void; onNext: () => void; onBack: () => void }
export default function StepGuestInfo({ form, onChange, onNext, onBack }: Props) {
  const valid = form.guestName && form.guestEmail && form.guestPhone
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">お客様情報</h3>
      <div className="space-y-4">
        {[
          { key: 'guestName', label: 'お名前', type: 'text', placeholder: '山田 太郎' },
          { key: 'guestEmail', label: 'メールアドレス', type: 'email', placeholder: 'taro@example.com' },
          { key: 'guestPhone', label: '電話番号', type: 'tel', placeholder: '090-1234-5678' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-sm text-warm-500 mb-1">{f.label} <span className="text-red-400">*</span></label>
            <input type={f.type} placeholder={f.placeholder} value={(form as unknown as Record<string, string>)[f.key] ?? ''}
              onChange={e => onChange({ [f.key]: e.target.value })}
              className="w-full border border-warm-200 rounded-lg px-4 py-3 text-warm-700 focus:outline-none focus:border-warm-400 text-base" />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={onNext} disabled={!valid} className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors text-base">確認画面へ →</button>
      </div>
    </div>
  )
}
