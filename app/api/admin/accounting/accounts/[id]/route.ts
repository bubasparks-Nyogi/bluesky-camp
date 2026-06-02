import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { canDeleteAccount } from '@/lib/accounting/accountRules'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const update: Record<string, unknown> = {}
  if (body.name        !== undefined) update.name        = body.name
  if (body.code        !== undefined) update.code        = body.code
  if (body.sort_order  !== undefined) update.sort_order  = body.sort_order
  if (body.is_active   !== undefined) update.is_active   = Boolean(body.is_active)
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })

  const { error } = await supabaseAdmin.from('accounts').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: usedRows } = await supabaseAdmin
    .from('journal_lines').select('account_id').eq('account_id', params.id).limit(1)
  const usedIds = (usedRows ?? []).map(r => r.account_id as string)
  if (!canDeleteAccount(params.id, usedIds))
    return NextResponse.json({ error: '使用中の科目は削除できません（無効化してください）' }, { status: 409 })

  const { error } = await supabaseAdmin.from('accounts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
