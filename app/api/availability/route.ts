import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year  = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year と month が必要です' }, { status: 400 })
  }

  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay  = new Date(year, month, 0).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('reservations')
    .select('checkin_date, checkout_date')
    .neq('status', 'cancelled')
    .lte('checkin_date', lastDay)
    .gte('checkout_date', firstDay)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const booked = new Set<string>()
  for (const row of data ?? []) {
    booked.add(row.checkin_date)
  }

  return NextResponse.json({ booked: Array.from(booked) })
}
