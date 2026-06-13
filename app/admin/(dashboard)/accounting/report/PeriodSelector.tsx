'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]

export default function PeriodSelector({ availableYears }: { availableYears: number[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const year = Number(params.get('year') ?? new Date().getFullYear())
  const month = params.get('month') ? Number(params.get('month')) : null

  const update = (next: { year?: number; month?: number | null }) => {
    const sp = new URLSearchParams(params.toString())
    if (next.year !== undefined) sp.set('year', String(next.year))
    if (next.month === null) sp.delete('month')
    else if (next.month !== undefined) sp.set('month', String(next.month))
    router.push(`?${sp.toString()}`)
  }

  const csvHref = (format: 'yayoi' | 'freee') => {
    const sp = new URLSearchParams()
    sp.set('format', format); sp.set('year', String(year))
    if (month) sp.set('month', String(month))
    return `/api/admin/accounting/csv?${sp.toString()}`
  }

  return (
    <div className="sticky top-0 z-10 bg-warm-50 border-b border-warm-100 py-3 mb-4 flex flex-wrap gap-2 items-center">
      <label className="text-sm text-warm-500">年度
        <select value={year} onChange={e => update({ year: Number(e.target.value) })}
          className="ml-2 border border-warm-200 rounded px-2 py-1">
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label className="text-sm text-warm-500 inline-flex items-center gap-2">
        <input type="radio" checked={month !== null} onChange={() => update({ month: new Date().getMonth() + 1 })} /> 月次
      </label>
      <label className="text-sm text-warm-500 inline-flex items-center gap-2">
        <input type="radio" checked={month === null} onChange={() => update({ month: null })} /> 年次
      </label>
      {month !== null && (
        <label className="text-sm text-warm-500">月
          <select value={month} onChange={e => update({ month: Number(e.target.value) })}
            className="ml-2 border border-warm-200 rounded px-2 py-1">
            {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
        </label>
      )}
      <div className="ml-auto flex gap-2">
        <a href={csvHref('yayoi')} className="bg-warm-500 hover:bg-warm-600 text-white text-sm px-3 py-1.5 rounded">📥 弥生CSV</a>
        <a href={csvHref('freee')} className="bg-warm-500 hover:bg-warm-600 text-white text-sm px-3 py-1.5 rounded">📥 freee CSV</a>
      </div>
    </div>
  )
}
