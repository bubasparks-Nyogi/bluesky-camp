// app/api/weather/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getWeatherForecast } from '@/lib/weather'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date パラメーターが必要です（形式: YYYY-MM-DD）' },
      { status: 400 }
    )
  }
  const forecast = await getWeatherForecast(date)
  if (!forecast) return NextResponse.json({ forecast: null })
  return NextResponse.json({ forecast })
}
