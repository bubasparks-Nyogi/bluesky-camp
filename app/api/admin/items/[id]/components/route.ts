import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateComponent } from '@/lib/items/validate'
import { detectRecipeCycle } from '@/lib/items/cycle'
import type { ComponentEdge } from '@/lib/items/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('item_components')
    .select('id, parent_item_id, component_item_id, quantity')
    .eq('parent_item_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ components: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { componentItemId?: string; quantity?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const componentId = body.componentItemId ?? ''
  const quantity = Number(body.quantity)
  const verr = validateComponent(params.id, componentId, quantity)
  if (verr) return NextResponse.json({ error: verr }, { status: 400 })

  const { data: allEdges } = await supabaseAdmin
    .from('item_components').select('parent_item_id, component_item_id')
  const edges: ComponentEdge[] = (allEdges ?? []).map(e => ({
    parentId: e.parent_item_id, componentId: e.component_item_id,
  }))
  if (detectRecipeCycle(params.id, componentId, edges))
    return NextResponse.json({ error: 'この構成は循環するため追加できません' }, { status: 400 })

  const { error } = await supabaseAdmin.from('item_components').insert({
    parent_item_id: params.id, component_item_id: componentId, quantity,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
