'use client'
import type { ReservationFormData } from '@/types/reservation'
interface Props { form: ReservationFormData; onChange: (u: Partial<ReservationFormData>) => void; onNext: () => void }
export default function StepDate({ form, onChange, onNext }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const handleCheckin = (date: string) => {
    const next = new Date(date); next.setDate(next.getDate() + 1)
    onChange({ checkinDate: date, checkoutDate: next.toISOString().slice(0, 10) })
  }
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">日程を選択</h3>
      <div className="space-y-4">
        <div><label className="block text-sm text-warm-500 mb-1">チェックイン</label>
          <input type="date" min={today} value={form.checkinDate} onChange={e => handleCheckin(e.target.value)}
            className="w-full border border-warm-200 rounded-lg px-4 py-3 text-warm-700 focus:outline-none focus:border-warm-400 text-base" /></div>
        <div><label className="block text-sm text-warm-500 mb-1">チェックアウト（翌日自動設定）</label>
          <input type="date" value={form.checkoutDate} readOnly
            className="w-full border border-warm-100 rounded-lg px-4 py-3 text-warm-400 bg-warm-50 text-base cursor-not-allowed" /></div>
      </div>
      <button onClick={onNext} disabled={!form.checkinDate}
        className="mt-8 w-full bg-warm-300 hover:bg-warm-400 disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors text-base">
        次へ →</button>
    </div>
  )
}
