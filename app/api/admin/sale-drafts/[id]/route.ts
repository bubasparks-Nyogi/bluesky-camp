import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { itemId?: string | null; unitPrice?: number | null; quantity?: number; occurredAt?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.itemId !== undefined)     update.item_id = body.itemId
  if (body.unitPrice !== undefined)  update.unit_price = body.unitPrice
  if (body.quantity !== undefined) {
    if (!(body.quantity > 0)) return NextResponse.json({ error: 'quantity > 0 が必要です' }, { status: 400 })
    update.quantity = body.quantity
  }
  if (body.occurredAt !== undefined) update.occurred_at = body.occurredAt

  const { data, error } = await supabaseAdmin
    .from('sale_drafts').update(update).eq('id', params.id).eq('status', 'pending')
    .select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'pending な抽出案が見つかりません' }, { status: 404 })
  return NextResponse.json({ draft: data })
}
