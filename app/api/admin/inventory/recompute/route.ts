import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { computeQuantity } from '@/lib/inventory/quantity'

export async function POST() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items } = await supabaseAdmin.from('items').select('id').eq('track_inventory', true)
  const { data: moves } = await supabaseAdmin.from('stock_movements').select('item_id, quantity_delta')

  const byItem = new Map<string, number[]>()
  for (const m of moves ?? []) {
    const arr = byItem.get(m.item_id) ?? []
    arr.push(Number(m.quantity_delta))
    byItem.set(m.item_id, arr)
  }

  for (const it of items ?? []) {
    const qty = computeQuantity(byItem.get(it.id) ?? [])
    await supabaseAdmin.from('items').update({ current_quantity: qty }).eq('id', it.id)
  }
  return NextResponse.json({ ok: true, recalculated: (items ?? []).length })
}
