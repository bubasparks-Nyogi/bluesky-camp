import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const [{ data }, { data: settings }, { data: rates }] = await Promise.all([
    supabase.from('pricing').select('item_key, label, amount, active').eq('active', true),
    supabaseAdmin.from('pricing_settings').select('multi_night_discount_rate').eq('id', 1).maybeSingle(),
    supabaseAdmin.from('seasonal_rates').select('start_date, end_date, multiplier'),
  ])
  const pricing = (data ?? []).map((p: {
    item_key: string; label: string; amount: number; active: boolean
  }) => ({
    itemKey: p.item_key, label: p.label, amount: p.amount, active: p.active,
  }))
  return NextResponse.json({
    pricing,
    rules: {
      multiNightDiscount: Number(settings?.multi_night_discount_rate ?? 0),
      seasonalRates: rates ?? [],
    },
  })
}
