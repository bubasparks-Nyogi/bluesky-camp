'use client'
import type { ReservationFormData } from '@/types/reservation'

interface Props {
  form: ReservationFormData
  onChange: (u: Partial<ReservationFormData>) => void
  onNext: () => void
}

export default function StepDate({ form, onChange, onNext }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // チェックインを変更したらチェックアウトを翌日にリセット
  const handleCheckin = (date: string) => {
    const next = new Date(date)
    next.setDate(next.getDate() + 1)
    onChange({ checkinDate: date, checkoutDate: next.toISOString().slice(0, 10) })
  }

  // チェックアウトはチェックイン翌日以降のみ選択可
  const minCheckout = form.checkinDate
    ? (() => { const d = new Date(form.checkinDate); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()
    : today

  const nights = form.checkinDate && form.checkoutDate
    ? Math.round((new Date(form.checkoutDate).getTime() - new Date(form.checkinDate).getTime()) / 86400000)
    : 0

  const canNext = !!form.checkinDate && !!form.checkoutDate && nights >= 1

  return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">日程を選択</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-warm-500 mb-1">チェックイン</label>
          <input type="date" min={today} value={form.checkinDate}
            onChange={e => handleCheckin(e.target.value)}
            className="w-full border border-warm-200 rounded-lg px-4 py-3 text-warm-700 focus:outline-none focus:border-warm-400 text-base" />
        </div>
        <div>
          <label className="block text-sm text-warm-500 mb-1">チェックアウト</label>
          <input type="date" min={minCheckout} value={form.checkoutDate}
            disabled={!form.checkinDate}
            onChange={e => onChange({ checkoutDate: e.target.value })}
            className="w-full border border-warm-200 rounded-lg px-4 py-3 text-warm-700 focus:outline-none focus:border-warm-400 text-base disabled:bg-warm-50 disabled:text-warm-300 disabled:cursor-not-allowed" />
        </div>
        {nights >= 1 && (
          <div className="bg-warm-50 rounded-lg px-4 py-2 text-sm text-warm-600 text-center font-medium">
            🌙 {nights}泊{nights + 1}日
          </div>
        )}
      </div>
      <button onClick={onNext} disabled={!canNext}
        className="mt-8 w-full bg-warm-300 hover:bg-warm-400 disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors text-base">
        次へ →
      </button>
    </div>
  )
}
