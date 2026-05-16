'use client'
import { useState, useEffect } from 'react'

interface Forecast {
  label:   string
  icon:    string
  tempMax: number
  tempMin: number
}

interface Props {
  date: string  // YYYY-MM-DD
}

export default function WeatherForecast({ date }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch(`/api/weather?date=${date}`)
      .then(r => r.json())
      .then(d => { setForecast(d.forecast ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [date])

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-warm-400 animate-pulse">
      <span>🌡️</span><span>天気予報を取得中...</span>
    </div>
  )

  if (!forecast) return null

  return (
    <div className="flex items-center gap-3 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 text-sm">
      <span className="text-2xl">{forecast.icon}</span>
      <div>
        <p className="text-warm-600 font-medium">チェックイン日の天気予報</p>
        <p className="text-warm-500 text-xs">
          {forecast.label}　最高 {forecast.tempMax}℃ / 最低 {forecast.tempMin}℃
        </p>
      </div>
    </div>
  )
}
