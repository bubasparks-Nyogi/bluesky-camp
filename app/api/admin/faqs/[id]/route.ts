import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const VALID_CATEGORIES = ['general', 'pricing', 'access', 'facility']
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category as string)) {
    return NextResponse.json({ error: 'category が不正です' }, { status: 400 })
  }
  if (body.sort_order !== undefined && !Number.isInteger(body.sort_order)) {
    return NextResponse.json({ error: 'sort_order は整数で指定してください' }, { status: 400 })
  }
  const update: Record<string, unknown> = {}
  if (body.question     !== undefined) update.question     = body.question
  if (body.answer       !== undefined) update.answer       = body.answer
  if (body.category     !== undefined) update.category     = body.category
  if (body.sort_order   !== undefined) update.sort_order   = body.sort_order
  if (body.is_published !== undefined) update.is_published = body.is_published

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('faqs').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin.from('faqs').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
