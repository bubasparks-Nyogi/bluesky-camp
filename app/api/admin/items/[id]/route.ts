import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateItem } from '@/lib/items/validate'
import type { ItemInput } from '@/lib/items/types'
import { normalizeTaxRate } from '@/lib/tax'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const displayStatus = (['available', 'sold_out', 'coming_soon'] as const).includes(body.displayStatus as never)
    ? body.displayStatus as 'available' | 'sold_out' | 'coming_soon'
    : 'available'
  const input: ItemInput = {
    name: String(body.name ?? ''),
    category: body.category as ItemInput['category'],
    unit: String(body.unit ?? '個'),
    salePrice: body.salePrice == null ? null : Number(body.salePrice),
    costPrice: body.costPrice == null ? null : Number(body.costPrice),
    isSellable: Boolean(body.isSellable),
    trackInventory: Boolean(body.trackInventory),
    taxRate: normalizeTaxRate(body.taxRate),
    displayStatus,
    onMenuDisplay: Boolean(body.onMenuDisplay),
  }
  const err = validateItem(input)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const update: Record<string, unknown> = {
    name: input.name.trim(), category: input.category, unit: input.unit,
    sale_price: input.salePrice, cost_price: input.costPrice,
    is_sellable: input.isSellable, track_inventory: input.trackInventory,
    tax_rate: input.taxRate,
    display_status: input.displayStatus,
    on_menu_display: input.onMenuDisplay,
  }
  if (body.isActive !== undefined) update.is_active = Boolean(body.isActive)
  if (body.sortOrder !== undefined && Number.isInteger(body.sortOrder)) update.sort_order = body.sortOrder

  const { error } = await supabaseAdmin.from('items').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: usedAs } = await supabaseAdmin
    .from('item_components').select('id').eq('component_item_id', params.id).limit(1)
  if ((usedAs ?? []).length > 0)
    return NextResponse.json({ error: '他の料理のレシピで使用中のため削除できません（無効化してください）' }, { status: 409 })

  const { error } = await supabaseAdmin.from('items').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
