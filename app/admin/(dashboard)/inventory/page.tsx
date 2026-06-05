import { supabaseAdmin } from '@/lib/supabase'
import InventoryManager from '@/components/admin/inventory/InventoryManager'

export const revalidate = 0

export default async function InventoryPage() {
  const { data: items } = await supabaseAdmin
    .from('items')
    .select('id, name, category, unit, current_quantity')
    .eq('track_inventory', true).eq('is_active', true)
    .order('category').order('name')

  const normalized = (items ?? []).map(i => ({
    id: i.id, name: i.name, category: i.category, unit: i.unit,
    current_quantity: Number(i.current_quantity),
  }))

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-warm-700 mb-6">在庫管理</h1>
      <p className="text-warm-400 text-sm mb-4">在庫管理対象の品目の現在庫・入出庫・廃棄・棚卸調整を管理します。</p>
      <InventoryManager items={normalized} />
    </div>
  )
}
