import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; lineId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // B-4: 紐づく在庫消費・売上仕訳を先に削除（best-effort）
  try {
    const { deleteSaleConsumption } = await import('@/lib/inventory/serverConsume')
    await deleteSaleConsumption(params.lineId)
  } catch (e) { console.error('deleteSaleConsumption failed:', e) }
  try {
    const { deleteSaleEntry } = await import('@/lib/accounting/serverSalePosting')
    await deleteSaleEntry(params.lineId)
  } catch (e) { console.error('deleteSaleEntry failed:', e) }

  const { error } = await supabaseAdmin
    .from('sale_lines').delete()
    .eq('id', params.lineId)
    .eq('reservation_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
