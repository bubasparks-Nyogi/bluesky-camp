import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateApprove } from '@/lib/admin/validateApprove'
import { audit } from '@/lib/security/auditLog'
import { normalizeTaxRate, taxFromIncluded } from '@/lib/tax'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: draft } = await supabaseAdmin
    .from('sale_drafts').select('*').eq('id', params.id).maybeSingle()
  if (!draft) return NextResponse.json({ error: '抽出案が見つかりません' }, { status: 404 })

  const validation = validateApprove({ status: draft.status, item_id: draft.item_id })
  if (!validation.ok) return NextResponse.json({ error: validation.message }, { status: validation.httpStatus })

  const { data: item } = await supabaseAdmin
    .from('items').select('id, name, sale_price, is_sellable, is_active, tax_rate').eq('id', draft.item_id).maybeSingle()
  if (!item)                     return NextResponse.json({ error: '品目が見つかりません' }, { status: 404 })
  if (item.is_sellable !== true) return NextResponse.json({ error: '販売不可の品目です' }, { status: 400 })
  const unitPrice = draft.unit_price ?? item.sale_price
  if (unitPrice == null)         return NextResponse.json({ error: '単価が未設定です' }, { status: 400 })

  const taxRate = normalizeTaxRate(item.tax_rate)
  const subtotal = Math.round(Number(unitPrice) * Number(draft.quantity))
  const taxAmount = taxFromIncluded(subtotal, taxRate)

  const { data: line, error: insErr } = await supabaseAdmin.from('sale_lines').insert({
    reservation_id: draft.reservation_id,
    item_id: draft.item_id,
    item_name: item.name,
    unit_price: unitPrice,
    quantity: Number(draft.quantity),
    tax_rate: taxRate,
    tax_amount: taxAmount,
    occurred_at: draft.occurred_at,
    note: `AI抽出: ${draft.item_name_raw}`,
  }).select().single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  await supabaseAdmin.from('sale_drafts').update({
    status: 'approved', approved_sale_line_id: line.id, updated_at: new Date().toISOString(),
  }).eq('id', params.id)

  try {
    const { postSaleConsumption } = await import('@/lib/inventory/serverConsume')
    await postSaleConsumption({
      id: line.id, item_id: line.item_id,
      quantity: Number(line.quantity), occurred_at: line.occurred_at,
    })
  } catch (e) { console.error('postSaleConsumption failed:', e) }
  try {
    const { postSaleEntry } = await import('@/lib/accounting/serverSalePosting')
    await postSaleEntry({
      id: line.id, item_name: line.item_name,
      unit_price: line.unit_price, quantity: Number(line.quantity),
      occurred_at: line.occurred_at,
    })
  } catch (e) { console.error('postSaleEntry failed:', e) }

  await audit({
    actor: user.email ?? 'admin', action: 'sale_draft.approve',
    targetType: 'sale_draft', targetId: params.id,
    detail: { saleLineId: line.id, itemId: draft.item_id, quantity: Number(draft.quantity), unitPrice },
  })

  return NextResponse.json({ saleLineId: line.id }, { status: 200 })
}
