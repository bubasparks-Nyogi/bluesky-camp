'use client'
import { useState, useEffect } from 'react'
import type { ReservationRow } from '@/types/reservation'

interface BlockedDate { id: string; date: string; reason: string | null }

interface DayInfo {
  date: string
  reservation: ReservationRow | null
  blocked: BlockedDate | null
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function ReservationCalendar() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [days,  setDays]  = useState<DayInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [selected, setSelected] = useState<DayInfo | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const ym = `${year}-${String(month).padStart(2, '0')}`
    Promise.all([
      fetch(`/api/admin/reservations?month=${ym}`).then(r => r.json()),
      fetch(`/api/admin/blocked-dates?month=${ym}`).then(r => r.json()),
    ]).then(([resData, blockData]) => {
      const reservations: ReservationRow[] = resData.reservations ?? []
      const blocked: BlockedDate[]         = blockData.blocked ?? []
      const allDays = getDaysInMonth(year, month)
      setDays(allDays.map(date => ({
        date,
        reservation: reservations.find(r => r.checkin_date === date) ?? null,
        blocked:     blocked.find(b => b.date === date) ?? null,
      })))
      setLoading(false)
    }).catch(err => {
      setError(err.message ?? '読み込みに失敗しました')
      setLoading(false)
    })
  }, [year, month])

  const firstDow = new Date(year, month - 1, 1).getDay()

  const prev = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const next = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={prev} className="px-4 py-2 bg-warm-100 hover:bg-warm-200 rounded-lg text-warm-600 text-sm">← 前月</button>
        <h2 className="font-serif text-xl text-warm-700 font-bold">{year}年{month}月</h2>
        <button onClick={next} className="px-4 py-2 bg-warm-100 hover:bg-warm-200 rounded-lg text-warm-600 text-sm">次月 →</button>
      </div>

      {error ? (
        <p className="text-center text-red-400 py-12">{error}</p>
      ) : loading ? (
        <p className="text-center text-warm-400 py-12">読み込み中...</p>
      ) : (
        <>
          <div className="grid grid-cols-7 text-center text-xs text-warm-400 mb-1">
            {['日','月','火','水','木','金','土'].map(d => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {days.map(day => {
              const d = new Date(day.date)
              const bg = day.blocked
                ? 'bg-gray-200 text-gray-500 cursor-pointer'
                : day.reservation
                  ? 'bg-orange-100 text-orange-700 cursor-pointer'
                  : 'bg-warm-50 text-warm-500 cursor-default'
              return (
                <div key={day.date} onClick={() => (day.reservation || day.blocked) && setSelected(day)}
                     className={`rounded-lg p-1.5 text-xs min-h-[52px] ${bg} hover:opacity-80 transition-opacity`}>
                  <div className="font-bold">{d.getDate()}</div>
                  {day.blocked     && <div className="truncate text-[10px] mt-0.5">{day.blocked.reason ?? 'ブロック'}</div>}
                  {day.reservation && <div className="truncate text-[10px] mt-0.5">{day.reservation.guest_name}</div>}
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-warm-400">
            <span><span className="inline-block w-3 h-3 bg-orange-100 rounded mr-1" />予約済</span>
            <span><span className="inline-block w-3 h-3 bg-gray-200 rounded mr-1" />ブロック</span>
            <span><span className="inline-block w-3 h-3 bg-warm-50 border border-warm-200 rounded mr-1" />空き</span>
          </div>
        </>
      )}

      {/* 詳細モーダル */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
             onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-warm-700 mb-4">{selected.date}</h3>
            {selected.blocked && (
              <p className="text-sm text-gray-600 mb-3">🚫 ブロック理由: {selected.blocked.reason ?? 'なし'}</p>
            )}
            {selected.reservation && (
              <div className="text-sm space-y-1 text-warm-600">
                <p><strong>お客様:</strong> {selected.reservation.guest_name}</p>
                <p><strong>メール:</strong> {selected.reservation.guest_email}</p>
                <p><strong>電話:</strong> {selected.reservation.guest_phone}</p>
                <p><strong>宿泊タイプ:</strong> {selected.reservation.stay_type}</p>
                <p><strong>合計:</strong> ¥{selected.reservation.total_amount.toLocaleString()}</p>
                <p><strong>ステータス:</strong> {selected.reservation.status}</p>
                {selected.reservation.agreed_to_terms_at && (
                  <p className="text-xs text-warm-400">同意日時: {new Date(selected.reservation.agreed_to_terms_at).toLocaleString('ja-JP')}</p>
                )}
              </div>
            )}
            <button onClick={() => setSelected(null)}
                    className="mt-4 w-full bg-warm-100 hover:bg-warm-200 text-warm-600 font-bold py-2 rounded-lg text-sm">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
