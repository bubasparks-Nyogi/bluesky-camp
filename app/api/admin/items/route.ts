import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateItem } from '@/lib/items/validate'
import { computeDishCost } from '@/lib/items/cost'
import type { ItemInput } from '@/lib/items/types'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items, error } = await supabaseAdmin
    .from('items').select('*').order('sort_order').order('category')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: comps } = await supabaseAdmin.from('item_components').select('*')
  const costById = new Map((items ?? []).map(i => [i.id, i.cost_price as number | null]))

  const dishCost: Record<string, { cost: number; hasMissingCost: boolean }> = {}
  for (const it of items ?? []) {
    if (it.category !== 'dish') continue
    const lines = (comps ?? [])
      .filter(c => c.parent_item_id === it.id)
      .map(c => ({ costPrice: costById.get(c.component_item_id) ?? null, quantity: Number(c.quantity) }))
    dishCost[it.id] = computeDishCost(lines)
  }

  return NextResponse.json({ items: items ?? [], dishCost })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const input: ItemInput = {
    name: String(body.name ?? ''),
    category: body.category as ItemInput['category'],
    unit: String(body.unit ?? '個'),
    salePrice: body.salePrice == null ? null : Number(body.salePrice),
    costPrice: body.costPrice == null ? null : Number(body.costPrice),
    isSellable: Boolean(body.isSellable),
    trackInventory: Boolean(body.trackInventory),
  }
  const err = validateItem(input)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('items').insert({
    name: input.name.trim(), category: input.category, unit: input.unit,
    sale_price: input.salePrice, cost_price: input.costPrice,
    is_sellable: input.isSellable, track_inventory: input.trackInventory,
    sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
