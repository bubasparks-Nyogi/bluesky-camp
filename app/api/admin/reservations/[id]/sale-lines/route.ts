import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { saleLineCreateSchema } from '@/lib/validation/saleLine'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('sale_lines').select('*')
    .eq('reservation_id', params.id)
    .order('occurred_at', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saleLines: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const parsed = saleLineCreateSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first?.message ?? '入力内容を確認してください', field: first?.path.join('.') },
      { status: 400 },
    )
  }
  const { itemId, quantity, occurredAt, note } = parsed.data

  const { data: item } = await supabaseAdmin
    .from('items').select('id, name, sale_price, is_sellable, is_active').eq('id', itemId).maybeSingle()
  if (!item)                     return NextResponse.json({ error: '品目が見つかりません' }, { status: 404 })
  if (item.is_sellable !== true) return NextResponse.json({ error: '販売不可の品目です' }, { status: 400 })
  if (item.sale_price == null)   return NextResponse.json({ error: '販売価格が未設定の品目です' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('sale_lines').insert({
    reservation_id: params.id,
    item_id: itemId,
    item_name: item.name,
    unit_price: item.sale_price,
    quantity,
    occurred_at: occurredAt,
    note: note ?? null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // B-4: 在庫消費 + 売上仕訳（best-effort）
  try {
    const { postSaleConsumption } = await import('@/lib/inventory/serverConsume')
    await postSaleConsumption({
      id: data.id, item_id: data.item_id,
      quantity: Number(data.quantity), occurred_at: data.occurred_at,
    })
  } catch (e) { console.error('postSaleConsumption failed:', e) }
  try {
    const { postSaleEntry } = await import('@/lib/accounting/serverSalePosting')
    await postSaleEntry({
      id: data.id, item_name: data.item_name,
      unit_price: data.unit_price, quantity: Number(data.quantity),
      occurred_at: data.occurred_at,
    })
  } catch (e) { console.error('postSaleEntry failed:', e) }

  return NextResponse.json({ saleLine: data }, { status: 201 })
}
