import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: settings }, { data: rates }] = await Promise.all([
    supabaseAdmin.from('pricing_settings').select('multi_night_discount_rate').eq('id', 1).maybeSingle(),
    supabaseAdmin.from('seasonal_rates').select('*').order('start_date'),
  ])
  return NextResponse.json({
    multiNightDiscount: Number(settings?.multi_night_discount_rate ?? 0),
    seasonalRates: rates ?? [],
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { multiNightDiscount?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const rate = body.multiNightDiscount
  if (typeof rate !== 'number' || rate < 0 || rate >= 1)
    return NextResponse.json({ error: '0 以上 1 未満の数値が必要です' }, { status: 400 })

  const { error } = await supabaseAdmin.from('pricing_settings').update({
    multi_night_discount_rate: rate, updated_at: new Date().toISOString(),
  }).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
