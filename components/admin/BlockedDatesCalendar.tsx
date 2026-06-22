'use client'
import { useState, useMemo } from 'react'

export interface BlockedRow { id: string; date: string; reason: string | null }
export interface ReservedRow { date: string; guestName: string }

interface Props {
  blocked: BlockedRow[]
  reserved: ReservedRow[]
  onAdd: (date: string, reason: string | null) => Promise<{ ok: boolean; row?: BlockedRow; error?: string }>
  onRemove: (id: string) => Promise<{ ok: boolean; error?: string }>
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function BlockedDatesCalendar({ blocked: initialBlocked, reserved, onAdd, onRemove }: Props) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)  // 1-12
  const [blocked, setBlocked] = useState<BlockedRow[]>(initialBlocked)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blockedMap  = useMemo(() => new Map(blocked.map(b => [b.date, b])), [blocked])
  const reservedMap = useMemo(() => new Map(reserved.map(r => [r.date, r])), [reserved])

  // 月初の曜日とその月の日数
  const firstDay = new Date(year, month - 1, 1)
  const lastDay  = new Date(year, month, 0)
  const startWeekday = firstDay.getDay()
  const daysInMonth  = lastDay.getDate()

  // セル配列：先頭の空セル + 1〜daysInMonth
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const move = (delta: number) => {
    let y = year, m = month + delta
    if (m < 1)  { m = 12; y -= 1 }
    if (m > 12) { m = 1;  y += 1 }
    setYear(y); setMonth(m); setError(null)
  }

  const toDateStr = (day: number): string =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const handleClick = async (day: number) => {
    setError(null)
    const dateStr = toDateStr(day)
    if (dateStr < todayStr) return  // 過去日
    if (busy) return

    const existing = blockedMap.get(dateStr)
    const reservedRow = reservedMap.get(dateStr)

    if (existing) {
      if (!confirm(`${dateStr} のブロックを解除しますか？\n${existing.reason ? `理由: ${existing.reason}` : ''}`)) return
      setBusy(true)
      const res = await onRemove(existing.id)
      setBusy(false)
      if (res.ok) setBlocked(prev => prev.filter(b => b.id !== existing.id))
      else setError(res.error ?? '解除失敗')
      return
    }

    if (reservedRow) {
      alert(`${dateStr} は既に予約済み（${reservedRow.guestName} 様）のためブロックできません`)
      return
    }

    const reason = prompt(`${dateStr} をブロックしますか？\n理由（任意）:`)
    if (reason === null) return  // キャンセル
    setBusy(true)
    const res = await onAdd(dateStr, reason || null)
    setBusy(false)
    if (res.ok && res.row) setBlocked(prev => [...prev, res.row!])
    else setError(res.error ?? '追加失敗')
  }

  return (
    <div className="bg-white border border-warm-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => move(-1)} className="text-warm-500 hover:text-warm-700 text-lg px-2">←</button>
        <span className="font-bold text-warm-700">{year} 年 {month} 月</span>
        <button onClick={() => move(1)}  className="text-warm-500 hover:text-warm-700 text-lg px-2">→</button>
      </div>

      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-warm-400 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : ''}`}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />
          const dateStr = toDateStr(day)
          const isPast = dateStr < todayStr
          const isToday = dateStr === todayStr
          const isBlocked = blockedMap.has(dateStr)
          const isReserved = reservedMap.has(dateStr)
          const wd = (startWeekday + day - 1) % 7

          let bg = 'bg-warm-50 hover:bg-warm-100'
          if (isPast)            bg = 'bg-gray-50 text-gray-300 cursor-not-allowed'
          else if (isBlocked)    bg = 'bg-red-100 hover:bg-red-200 text-red-700 font-bold'
          else if (isReserved)   bg = 'bg-yellow-100 text-yellow-700 cursor-help'
          else if (isToday)      bg = 'bg-warm-200 hover:bg-warm-300 text-warm-700 font-bold'

          const blockedRow  = blockedMap.get(dateStr)
          const reservedRow = reservedMap.get(dateStr)
          const title = isBlocked  ? `ブロック中${blockedRow?.reason ? `: ${blockedRow.reason}` : ''}` :
                        isReserved ? `予約済: ${reservedRow?.guestName} 様` :
                        isPast     ? '過去日' :
                        'クリックでブロック'

          return (
            <button
              key={dateStr}
              onClick={() => !isPast && handleClick(day)}
              disabled={isPast || busy}
              title={title}
              className={`aspect-square rounded text-sm flex items-center justify-center transition-colors ${bg} ${
                wd === 0 && !isPast && !isBlocked && !isReserved ? 'text-red-500' :
                wd === 6 && !isPast && !isBlocked && !isReserved ? 'text-blue-500' : ''
              }`}
            >
              <div className="text-center">
                <div>{day}</div>
                {isBlocked  && <div className="text-[10px]">🚫</div>}
                {isReserved && !isBlocked && <div className="text-[10px]">●</div>}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-warm-500">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-100 rounded"></span> ブロック中</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 bg-yellow-100 rounded"></span> 予約済</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 bg-warm-200 rounded"></span> 今日</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 bg-warm-50 rounded border border-warm-100"></span> 空き（クリックでブロック）</span>
      </div>
    </div>
  )
}
