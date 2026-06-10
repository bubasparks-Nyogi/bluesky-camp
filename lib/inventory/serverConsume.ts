import { supabaseAdmin } from '@/lib/supabase'
import { expandConsumption, type ItemLite, type ComponentLine } from './consume'

export async function postSaleConsumption(saleLine: {
  id: string
  item_id: string
  quantity: number
  occurred_at: string
}): Promise<void> {
  const { data: targetItem } = await supabaseAdmin
    .from('items').select('id, category, track_inventory').eq('id', saleLine.item_id).maybeSingle()
  if (!targetItem) return

  let components: ComponentLine[] = []
  const lookup = new Map<string, ItemLite>()

  if (targetItem.category === 'dish') {
    const { data: comps } = await supabaseAdmin
      .from('item_components').select('component_item_id, quantity')
      .eq('parent_item_id', targetItem.id)
    components = (comps ?? []).map(c => ({
      componentItemId: c.component_item_id,
      quantity: Number(c.quantity),
    }))
    const componentIds = components.map(c => c.componentItemId)
    if (componentIds.length > 0) {
      const { data: compItems } = await supabaseAdmin
        .from('items').select('id, category, track_inventory').in('id', componentIds)
      for (const ci of compItems ?? []) {
        lookup.set(ci.id, { id: ci.id, category: ci.category, trackInventory: ci.track_inventory })
      }
    }
  }
  lookup.set(targetItem.id, { id: targetItem.id, category: targetItem.category, trackInventory: targetItem.track_inventory })

  const consumptions = expandConsumption({
    saleQuantity: Number(saleLine.quantity),
    item: { id: targetItem.id, category: targetItem.category, trackInventory: targetItem.track_inventory },
    components,
    itemLookup: lookup,
  })
  if (consumptions.length === 0) return

  const note = `sale_line:${saleLine.id}`
  for (const c of consumptions) {
    const { error: insErr } = await supabaseAdmin.from('stock_movements').insert({
      item_id: c.itemId,
      type: 'consume',
      quantity_delta: -c.quantity,
      note,
      occurred_at: saleLine.occurred_at,
    })
    if (insErr) {
      console.error('postSaleConsumption insert failed:', insErr)
      continue
    }
    const { data: it } = await supabaseAdmin
      .from('items').select('current_quantity').eq('id', c.itemId).maybeSingle()
    const cur = Number(it?.current_quantity ?? 0)
    await supabaseAdmin.from('items').update({ current_quantity: cur - c.quantity }).eq('id', c.itemId)
  }
}

export async function deleteSaleConsumption(saleLineId: string): Promise<void> {
  const note = `sale_line:${saleLineId}`
  const { data: moves } = await supabaseAdmin
    .from('stock_movements')
    .select('id, item_id, quantity_delta').eq('note', note).eq('type', 'consume')
  for (const m of moves ?? []) {
    const { data: it } = await supabaseAdmin
      .from('items').select('current_quantity').eq('id', m.item_id).maybeSingle()
    const cur = Number(it?.current_quantity ?? 0)
    const delta = Number(m.quantity_delta)
    await supabaseAdmin.from('items').update({ current_quantity: cur - delta }).eq('id', m.item_id)
    await supabaseAdmin.from('stock_movements').delete().eq('id', m.id)
  }
}
