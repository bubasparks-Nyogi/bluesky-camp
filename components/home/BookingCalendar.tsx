'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function BookingCalendar() {
  const router = useRouter()
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [booked, setBooked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/availability?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        setBooked(new Set(d.booked ?? []))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [year, month])

  const days = getDaysInMonth(year, month)
  const firstDow = new Date(year, month - 1, 1).getDay()
  const todayIso = today.toISOString().slice(0, 10)

  const handleDayClick = (iso: string) => {
    router.push(`/reserve?date=${iso}`)
  }

  const prev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="max-w-sm mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prev}
          className="p-2 text-warm-400 hover:text-warm-600 text-xl font-bold leading-none"
          aria-label="前月"
        >
          ‹
        </button>
        <span className="font-serif text-warm-600 font-bold">
          {year}年{month}月
        </span>
        <button
          onClick={next}
          className="p-2 text-warm-400 hover:text-warm-600 text-xl font-bold leading-none"
          aria-label="次月"
        >
          ›
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 text-center text-xs text-warm-400 mb-1">
        {['日','月','火','水','木','金','土'].map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* 日付グリッド */}
      {loading ? (
        <div className="text-center py-8 text-warm-400 text-sm">読み込み中...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(d => {
            const iso      = d.toISOString().slice(0, 10)
            const past     = iso < todayIso
            const isBooked = booked.has(iso)
            const available = !past && !isBooked

            if (available) {
              return (
                <button
                  key={iso}
                  onClick={() => handleDayClick(iso)}
                  className="py-2 rounded text-xs font-medium transition-colors bg-warm-100 text-warm-600 hover:bg-warm-300 hover:text-white active:scale-95 cursor-pointer"
                  aria-label={`${d.getMonth() + 1}月${d.getDate()}日 空き`}
                >
                  <div>{d.getDate()}</div>
                  <div className="text-xs mt-0.5 font-bold">○</div>
                </button>
              )
            }

            return (
              <div
                key={iso}
                className={[
                  'py-2 rounded text-xs font-medium',
                  past               ? 'text-gray-300' : '',
                  !past && isBooked  ? 'bg-red-100 text-red-400' : '',
                ].join(' ')}
              >
                <div>{d.getDate()}</div>
                {!past && (
                  <div className="text-xs mt-0.5 font-bold">×</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 予約ボタン */}
      <button
        onClick={() => router.push('/reserve')}
        className="mt-6 w-full bg-warm-300 hover:bg-warm-400 active:scale-95
                   text-white font-bold py-3 rounded-lg transition-all text-base
                   shadow-md"
      >
        予約する →
      </button>

      {/* 凡例 */}
      <div className="flex justify-center gap-6 mt-3 text-xs text-warm-400">
        <span><span className="text-warm-600 font-bold">○</span> 空き（タップで予約）</span>
        <span><span className="text-red-400 font-bold">×</span> 満室</span>
      </div>
    </div>
  )
}
