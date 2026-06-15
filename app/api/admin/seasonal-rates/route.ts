import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { label?: string; startDate?: string; endDate?: string; multiplier?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { label, startDate, endDate, multiplier } = body
  if (!label || !startDate || !endDate || typeof multiplier !== 'number')
    return NextResponse.json({ error: 'label / startDate / endDate / multiplier が必要です' }, { status: 400 })
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate))
    return NextResponse.json({ error: '日付の形式が不正です（YYYY-MM-DD）' }, { status: 400 })
  if (endDate < startDate)
    return NextResponse.json({ error: '終了日は開始日以降を指定してください' }, { status: 400 })
  if (!(multiplier > 0))
    return NextResponse.json({ error: '倍率は 0 より大きい値を指定してください' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('seasonal_rates').insert({
    label, start_date: startDate, end_date: endDate, multiplier,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rate: data }, { status: 201 })
}
