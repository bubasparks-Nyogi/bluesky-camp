import { supabaseAdmin } from '@/lib/supabase'
import PricingForm from '@/components/admin/PricingForm'
import PricingRulesForm from '@/components/admin/PricingRulesForm'

export const metadata = { title: '料金設定 | @blueSky 管理' }
export const dynamic = 'force-dynamic'

export default async function AdminPricingPage() {
  const [{ data }, { data: settings }, { data: rates }] = await Promise.all([
    supabaseAdmin.from('pricing').select('*').order('amount', { ascending: false }),
    supabaseAdmin.from('pricing_settings').select('multi_night_discount_rate').eq('id', 1).maybeSingle(),
    supabaseAdmin.from('seasonal_rates').select('*').order('start_date'),
  ])
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">基本料金</h1>
        <PricingForm items={data ?? []} />
      </div>
      <div>
        <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">割引・季節料金</h1>
        <PricingRulesForm
          initialDiscount={Number(settings?.multi_night_discount_rate ?? 0)}
          initialRates={(rates ?? []) as Parameters<typeof PricingRulesForm>[0]['initialRates']}
        />
      </div>
    </div>
  )
}
