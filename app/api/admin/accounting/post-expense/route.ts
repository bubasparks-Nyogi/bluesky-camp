import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildExpenseEntry } from '@/lib/accounting/ocrReceipt'
import { validateEntry } from '@/lib/accounting/validateEntry'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    date?: string; amount?: number; description?: string
    debitAccountId?: string; creditAccountId?: string; receiptPath?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { date, amount, description, debitAccountId, creditAccountId, receiptPath } = body
  if (!date || !debitAccountId || !creditAccountId || typeof amount !== 'number')
    return NextResponse.json({ error: '日付・金額・科目が必要です' }, { status: 400 })

  const { data: accs } = await supabaseAdmin.from('accounts').select('id').in('id', [debitAccountId, creditAccountId])
  if (!accs || accs.length < 2)
    return NextResponse.json({ error: '指定された科目が見つかりません' }, { status: 400 })

  let entry
  try {
    entry = buildExpenseEntry({ date, amount, description: description ?? '', debitAccountId, creditAccountId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '仕訳の組み立てに失敗しました' }, { status: 400 })
  }
  const err = validateEntry(entry)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({ entry_date: entry.entryDate, description: entry.description, source: 'expense', receipt_url: receiptPath ?? null })
    .select().single()
  if (headerErr || !header) return NextResponse.json({ error: headerErr?.message ?? '仕訳の作成に失敗しました' }, { status: 500 })

  const lines = entry.lines.map((l, i) => ({
    journal_entry_id: header.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }
  return NextResponse.json({ entryId: header.id })
}
