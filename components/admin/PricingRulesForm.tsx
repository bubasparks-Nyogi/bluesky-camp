'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SeasonalRate {
  id: string
  label: string
  start_date: string
  end_date: string
  multiplier: number
}

interface Props {
  initialDiscount: number
  initialRates: SeasonalRate[]
}

export default function PricingRulesForm({ initialDiscount, initialRates }: Props) {
  const router = useRouter()
  const [discountPct, setDiscountPct] = useState(String(Math.round(initialDiscount * 100)))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // 季節料金フォーム
  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [mulPct, setMulPct] = useState('120') // 120 = 1.2x

  const saveDiscount = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null); setMsg(null)
    const pct = Number(discountPct)
    if (isNaN(pct) || pct < 0 || pct >= 100) { setErr('0〜99 の範囲で入力してください'); setBusy(false); return }
    const res = await fetch('/api/admin/pricing-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ multiNightDiscount: pct / 100 }),
    })
    setBusy(false)
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? '保存に失敗しました'); return }
    setMsg('連泊割引率を保存しました ✨')
    router.refresh()
  }

  const addRate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null); setMsg(null)
    const mul = Number(mulPct) / 100
    const res = await fetch('/api/admin/seasonal-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, startDate, endDate, multiplier: mul }),
    })
    setBusy(false)
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? '追加に失敗しました'); return }
    setMsg('季節料金を追加しました ✨')
    setLabel(''); setStartDate(''); setEndDate(''); setMulPct('120')
    router.refresh()
  }

  const deleteRate = async (id: string) => {
    if (!confirm('削除しますか？')) return
    const res = await fetch(`/api/admin/seasonal-rates/${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  const input = 'border border-warm-200 rounded px-3 py-2'
  const label_ = 'text-warm-500 text-sm block mb-1'

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="bg-white border border-warm-100 rounded-2xl p-5">
        <h2 className="font-bold text-warm-700 mb-3">連泊割引</h2>
        <p className="text-warm-400 text-xs mb-3">2泊目以降の宿泊料金に対する割引率。例: 10 と入力すると 2泊目以降が −10% になります。</p>
        <form onSubmit={saveDiscount} className="flex items-center gap-2">
          <input className={`${input} w-24`} type="number" min="0" max="99" step="1" value={discountPct} onChange={e => setDiscountPct(e.target.value)} />
          <span className="text-warm-500">%</span>
          <button type="submit" disabled={busy}
            className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg disabled:opacity-50">
            {busy ? '保存中...' : '保存'}
          </button>
        </form>
      </section>

      <section className="bg-white border border-warm-100 rounded-2xl p-5">
        <h2 className="font-bold text-warm-700 mb-3">季節料金 / 期間別倍率</h2>
        <p className="text-warm-400 text-xs mb-3">期間内の宿泊料金に倍率を掛けます。例: 120 = 1.2倍（繁忙期割増）、80 = 0.8倍（閑散期割引）。複数登録可能。</p>

        {initialRates.length > 0 ? (
          <table className="w-full text-sm mb-4 border border-warm-100 rounded">
            <thead className="bg-warm-50">
              <tr>
                <th className="px-3 py-2 text-left text-warm-500 text-xs">ラベル</th>
                <th className="px-3 py-2 text-left text-warm-500 text-xs">期間</th>
                <th className="px-3 py-2 text-right text-warm-500 text-xs">倍率</th>
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {initialRates.map(r => (
                <tr key={r.id} className="border-t border-warm-100">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-warm-500">{r.start_date} 〜 {r.end_date}</td>
                  <td className="px-3 py-2 text-right">×{Number(r.multiplier).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => deleteRate(r.id)} className="text-red-500 text-sm hover:underline">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-warm-400 text-sm py-4">登録された期間別料金はまだありません。</p>
        )}

        <form onSubmit={addRate} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <label className="col-span-2"><span className={label_}>ラベル</span>
            <input className={`${input} w-full`} value={label} onChange={e => setLabel(e.target.value)} placeholder="例: 夏の繁忙期" required />
          </label>
          <label><span className={label_}>開始日</span>
            <input type="date" className={`${input} w-full`} value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </label>
          <label><span className={label_}>終了日</span>
            <input type="date" className={`${input} w-full`} value={endDate} onChange={e => setEndDate(e.target.value)} required />
          </label>
          <label><span className={label_}>倍率 (%)</span>
            <input type="number" min="1" max="500" step="1" className={`${input} w-full`} value={mulPct} onChange={e => setMulPct(e.target.value)} required />
          </label>
          <div className="md:col-span-4">
            <button type="submit" disabled={busy}
              className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-5 py-2 rounded-lg disabled:opacity-50">
              {busy ? '追加中...' : '＋ 追加'}
            </button>
          </div>
        </form>
      </section>

      {err && <p className="text-red-500 text-sm">{err}</p>}
      {msg && <p className="text-green-600 text-sm">{msg}</p>}
    </div>
  )
}
