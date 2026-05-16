// components/admin/StatsBar.tsx
'use client'
import { useState, useEffect } from 'react'

interface StatsData {
  count:     number
  revenue:   number
  occupancy: number
}

export default function StatsBar() {
  const [stats,   setStats]   = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    fetch(`/api/admin/stats?month=${month}`)
      .then(r => r.json())
      .then((data: StatsData) => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const cards = stats
    ? [
        { icon: '📅', label: '今月の予約件数', value: `${stats.count}件` },
        { icon: '💴', label: '今月の売上合計', value: `¥${stats.revenue.toLocaleString()}` },
        { icon: '📊', label: '今月の稼働率',   value: `${Math.round(stats.occupancy * 100)}%` },
      ]
    : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {loading || !cards
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-warm-200 animate-pulse">
              <div className="h-4 bg-warm-100 rounded w-1/2 mb-3" />
              <div className="h-7 bg-warm-100 rounded w-2/3" />
            </div>
          ))
        : cards.map(card => (
            <div key={card.label} className="bg-white rounded-xl p-5 border border-warm-200">
              <p className="text-xs text-warm-400 mb-1 flex items-center gap-1">
                <span>{card.icon}</span>
                <span>{card.label}</span>
              </p>
              <p className="text-2xl font-bold text-warm-700">{card.value}</p>
            </div>
          ))
      }
    </div>
  )
}
