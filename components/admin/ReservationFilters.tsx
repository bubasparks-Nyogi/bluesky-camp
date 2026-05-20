'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { buildSearch } from '@/lib/admin-filter-params'

const STATUS_OPTIONS = [
  { value: 'all',       label: 'すべてのステータス' },
  { value: 'pending',   label: '承認待ち' },
  { value: 'confirmed', label: '確定' },
  { value: 'cancelled', label: 'キャンセル' },
]

const STAY_OPTIONS = [
  { value: 'all',       label: 'すべての宿泊タイプ' },
  { value: 'day',       label: '日帰り' },
  { value: '1night',    label: '1泊' },
  { value: 'multi',     label: '連泊' },
]

interface Props { totalCount: number; visibleCount: number }

export default function ReservationFilters({ totalCount, visibleCount }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  const [q,      setQ]      = useState(sp.get('q')      ?? '')
  const [status, setStatus] = useState(sp.get('status') ?? 'all')
  const [stay,   setStay]   = useState(sp.get('stay')   ?? 'all')
  const [from,   setFrom]   = useState(sp.get('from')   ?? '')
  const [to,     setTo]     = useState(sp.get('to')     ?? '')

  const debouncedQ = useDebouncedValue(q, 300)

  useEffect(() => {
    const search = buildSearch({
      q:      debouncedQ || undefined,
      status: status === 'all' ? undefined : status,
      stay:   stay   === 'all' ? undefined : stay,
      from:   from   || undefined,
      to:     to     || undefined,
    })
    router.replace(`/admin/reservations${search}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, stay, from, to])

  const clear = () => {
    setQ(''); setStatus('all'); setStay('all'); setFrom(''); setTo('')
  }

  const hasActiveFilters = !!(q || status !== 'all' || stay !== 'all' || from || to)

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 mb-6 space-y-3">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 名前 / メール / 電話で検索"
          className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm"
        />
        <select value={status} onChange={e => setStatus(e.target.value)} className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={stay} onChange={e => setStay(e.target.value)} className="border border-warm-200 rounded-lg px-3 py-2 text-warm-700 focus:outline-none focus:border-warm-400 text-sm">
          {STAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="grid md:grid-cols-3 gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-warm-400 shrink-0">チェックイン:</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border border-warm-200 rounded-lg px-3 py-1.5 text-warm-700 focus:outline-none focus:border-warm-400 text-sm flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-warm-400 shrink-0">〜</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border border-warm-200 rounded-lg px-3 py-1.5 text-warm-700 focus:outline-none focus:border-warm-400 text-sm flex-1"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-warm-500">
            <strong className="text-warm-700">{visibleCount}</strong> / 全 {totalCount} 件
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-warm-500 hover:text-warm-700 underline"
            >
              フィルタをクリア
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
