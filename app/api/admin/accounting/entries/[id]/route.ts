import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateEntry } from '@/lib/accounting/validateEntry'
import type { JournalEntryInput } from '@/lib/accounting/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('journal_entries').select('*, journal_lines(*)').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ entry: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: JournalEntryInput
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const err = validateEntry(body)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { error: upErr } = await supabaseAdmin.from('journal_entries')
    .update({ entry_date: body.entryDate, description: body.description })
    .eq('id', params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // 既存明細を退避してから入れ替え（再挿入失敗時に復元してデータ破損を防ぐ）
  const { data: oldLines } = await supabaseAdmin
    .from('journal_lines').select('account_id, side, amount, line_order, tax_category')
    .eq('journal_entry_id', params.id)

  await supabaseAdmin.from('journal_lines').delete().eq('journal_entry_id', params.id)

  const lines = body.lines.map((l, i) => ({
    journal_entry_id: params.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    // 復元（退避した明細を戻す）
    if (oldLines && oldLines.length > 0) {
      await supabaseAdmin.from('journal_lines').insert(
        oldLines.map(l => ({ ...l, journal_entry_id: params.id }))
      )
    }
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin.from('journal_entries').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
