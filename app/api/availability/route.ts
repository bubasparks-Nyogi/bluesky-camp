import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkPublicGetLimit } from '@/lib/security/publicGetLimit'

/**
 * GET /api/availability?year=2026&month=7
 * 指定月の「×」日付リスト（予約済み + ブロック）を返す
 */
export async function GET(req: NextRequest) {
  const limited = checkPublicGetLimit(req, 'availability')
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const year  = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year と month が必要です' }, { status: 400 })
  }

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10)

  const [resResult, blockResult] = await Promise.all([
    supabase
      .from('reservations')
      .select('checkin_date')
      .neq('status', 'cancelled')
      .lte('checkin_date', lastDay)
      .gte('checkin_date', firstDay),
    supabase
      .from('blocked_dates')
      .select('date')
      .lte('date', lastDay)
      .gte('date', firstDay),
  ])

  if (resResult.error)   return NextResponse.json({ error: resResult.error.message },   { status: 500 })
  if (blockResult.error) return NextResponse.json({ error: blockResult.error.message }, { status: 500 })

  const booked = new Set<string>()
  for (const row of resResult.data   ?? []) booked.add(row.checkin_date)
  for (const row of blockResult.data ?? []) booked.add(row.date)

  return NextResponse.json({ booked: Array.from(booked) })
}
