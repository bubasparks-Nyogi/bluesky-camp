import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateEntry } from '@/lib/accounting/validateEntry'

/**
 * 振替仕訳を1本作成する（借方1・貸方1のシンプル振替）。
 * カード引落し消込・電子マネーチャージ・振替入金など汎用に使用。
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    date?: string; amount?: number; description?: string
    debitAccountId?: string; creditAccountId?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { date, amount, description, debitAccountId, creditAccountId } = body
  if (!date || !debitAccountId || !creditAccountId || typeof amount !== 'number')
    return NextResponse.json({ error: '日付・金額・借方・貸方は必須です' }, { status: 400 })
  if (!Number.isInteger(amount) || amount <= 0)
    return NextResponse.json({ error: '金額は正の整数で入力してください' }, { status: 400 })
  if (debitAccountId === creditAccountId)
    return NextResponse.json({ error: '借方と貸方に同じ科目は指定できません' }, { status: 400 })

  const { data: accs } = await supabaseAdmin.from('accounts').select('id').in('id', [debitAccountId, creditAccountId])
  if (!accs || accs.length < 2)
    return NextResponse.json({ error: '指定された科目が見つかりません' }, { status: 400 })

  const entry = {
    entryDate: date,
    description: description?.trim() || '振替',
    lines: [
      { accountId: debitAccountId,  side: 'debit'  as const, amount },
      { accountId: creditAccountId, side: 'credit' as const, amount },
    ],
  }
  const err = validateEntry(entry)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({ entry_date: entry.entryDate, description: entry.description, source: 'transfer' })
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
