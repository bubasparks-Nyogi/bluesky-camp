import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildMovementDelta } from '@/lib/inventory/movement'
import type { MovementType } from '@/lib/inventory/types'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const itemId = req.nextUrl.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId が必要です' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('stock_movements').select('*')
    .eq('item_id', itemId)
    .order('occurred_at', { ascending: false }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movements: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { itemId?: string; type?: string; value?: number; occurredAt?: string; note?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { itemId, type, value, occurredAt, note } = body
  if (!itemId || !type || typeof value !== 'number' || !occurredAt)
    return NextResponse.json({ error: 'itemId / type / value / occurredAt が必要です' }, { status: 400 })

  const { data: item } = await supabaseAdmin
    .from('items').select('id, track_inventory, current_quantity').eq('id', itemId).maybeSingle()
  if (!item) return NextResponse.json({ error: '品目が見つかりません' }, { status: 404 })
  if (item.track_inventory !== true) return NextResponse.json({ error: '在庫管理対象外の品目です' }, { status: 400 })

  const currentQty = Number(item.current_quantity)
  const result = buildMovementDelta(type as MovementType, value, currentQty)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { data: movement, error: insErr } = await supabaseAdmin
    .from('stock_movements')
    .insert({ item_id: itemId, type, quantity_delta: result.delta, note: note ?? null, occurred_at: occurredAt })
    .select().single()
  if (insErr || !movement) return NextResponse.json({ error: insErr?.message ?? '記録に失敗しました' }, { status: 500 })

  const newQty = currentQty + result.delta
  const { error: updErr } = await supabaseAdmin.from('items').update({ current_quantity: newQty }).eq('id', itemId)
  if (updErr) {
    await supabaseAdmin.from('stock_movements').delete().eq('id', movement.id)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }
  return NextResponse.json({ currentQuantity: newQty, movement })
}
