import { supabaseAdmin } from '@/lib/supabase'
import RentalItemsForm from '@/components/admin/RentalItemsForm'

export const metadata = { title: 'レンタル管理 | @blueSky 管理' }

export default async function AdminRentalItemsPage() {
  const { data } = await supabaseAdmin
    .from('rental_items')
    .select('*')
    .order('name')

  return (
    <div>
      <h1 className="font-serif text-2xl text-warm-700 font-bold mb-6">レンタル道具管理</h1>
      <RentalItemsForm items={data ?? []} />
    </div>
  )
}
