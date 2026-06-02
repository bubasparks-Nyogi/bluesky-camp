import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateEntry } from '@/lib/accounting/validateEntry'
import type { JournalEntryInput } from '@/lib/accounting/types'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')

  let query = supabaseAdmin
    .from('journal_entries')
    .select('*, journal_lines(*)')
    .order('entry_date', { ascending: true })
  if (from) query = query.gte('entry_date', from)
  if (to)   query = query.lte('entry_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: JournalEntryInput
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const err = validateEntry(body)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({ entry_date: body.entryDate, description: body.description, source: 'manual' })
    .select().single()
  if (headerErr || !header)
    return NextResponse.json({ error: headerErr?.message ?? '仕訳の作成に失敗しました' }, { status: 500 })

  const lines = body.lines.map((l, i) => ({
    journal_entry_id: header.id,
    account_id: l.accountId,
    side: l.side,
    amount: l.amount,
    line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }
  return NextResponse.json({ entryId: header.id }, { status: 201 })
}
