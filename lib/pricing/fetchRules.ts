import { supabaseAdmin } from '@/lib/supabase'
import type { SeasonalRate } from './seasonalMultiplier'

export interface PricingRules {
  multiNightDiscount: number
  seasonalRates: SeasonalRate[]
}

export async function fetchPricingRules(): Promise<PricingRules> {
  const [{ data: settings }, { data: rates }] = await Promise.all([
    supabaseAdmin.from('pricing_settings').select('multi_night_discount_rate').eq('id', 1).maybeSingle(),
    supabaseAdmin.from('seasonal_rates').select('start_date, end_date, multiplier'),
  ])
  return {
    multiNightDiscount: Number(settings?.multi_night_discount_rate ?? 0),
    seasonalRates: (rates ?? []) as SeasonalRate[],
  }
}
