import { supabaseAdmin } from '@/lib/supabase'
import PricingForm from '@/components/admin/PricingForm'
export const metadata = { title: '料金設定 | @blueSky 管理' }
export default async function AdminPricingPage() {
  const { data } = await supabaseAdmin.from('pricing').select('*').order('amount', { ascending: false })
  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">料金設定</h1>
      <PricingForm items={data ?? []} />
    </div>
  )
}
