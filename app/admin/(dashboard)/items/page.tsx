import { supabaseAdmin } from '@/lib/supabase'
import ItemManager from '@/components/admin/items/ItemManager'
import { computeDishCost } from '@/lib/items/cost'

export const revalidate = 0

export default async function ItemsPage() {
  const { data: items } = await supabaseAdmin.from('items').select('*').order('sort_order').order('category')
  const { data: comps } = await supabaseAdmin
    .from('item_components').select('id, parent_item_id, component_item_id, quantity')

  const costById = new Map((items ?? []).map(i => [i.id, i.cost_price as number | null]))
  const nameById = new Map((items ?? []).map(i => [i.id, { name: i.name as string, unit: i.unit as string }]))

  const dishCost: Record<string, { cost: number; hasMissingCost: boolean }> = {}
  const componentsByDish: Record<string, { id: string; component_item_id: string; quantity: number; items?: { name: string; unit: string; cost_price: number | null } }[]> = {}
  for (const it of items ?? []) {
    if (it.category !== 'dish') continue
    const rows = (comps ?? []).filter(c => c.parent_item_id === it.id)
    dishCost[it.id] = computeDishCost(rows.map(c => ({ costPrice: costById.get(c.component_item_id) ?? null, quantity: Number(c.quantity) })))
    componentsByDish[it.id] = rows.map(c => {
      const meta = nameById.get(c.component_item_id)
      return { id: c.id, component_item_id: c.component_item_id, quantity: Number(c.quantity), items: meta ? { name: meta.name, unit: meta.unit, cost_price: costById.get(c.component_item_id) ?? null } : undefined }
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-warm-700 mb-6">商品・メニュー管理</h1>
      <ItemManager initialItems={items ?? []} dishCost={dishCost} componentsByDish={componentsByDish} />
    </div>
  )
}
