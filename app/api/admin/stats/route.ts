// app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * GET /api/admin/stats?month=YYYY-MM
 * 指定月の予約件数・売上合計・稼働率を返す
 */
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // 'YYYY-MM'
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month パラメーターが必要です（形式: YYYY-MM）' }, { status: 400 })
  }

  const year        = Number(month.slice(0, 4))
  const monthNum    = Number(month.slice(5, 7))
  const firstDay    = `${month}-01`
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const lastDay     = `${month}-${String(daysInMonth).padStart(2, '0')}`

  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('total_amount')
    .neq('status', 'cancelled')
    .gte('checkin_date', firstDay)
    .lte('checkin_date', lastDay)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows      = data ?? []
  const count     = rows.length
  const revenue   = rows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0)
  const occupancy = daysInMonth > 0 ? count / daysInMonth : 0

  return NextResponse.json({ count, revenue, occupancy })
}
