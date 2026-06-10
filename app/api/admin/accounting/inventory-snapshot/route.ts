import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildSnapshotLines, buildSnapshotJournal } from '@/lib/inventory/snapshot'
import { validateEntry } from '@/lib/accounting/validateEntry'

const REQUIRED_CODES = ['105', '501']

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('inventory_snapshots').select('*')
    .order('fiscal_year', { ascending: false }).order('snapshot_type')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshots: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { fiscalYear?: number; type?: 'closing' | 'opening' }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { fiscalYear, type } = body
  if (typeof fiscalYear !== 'number' || !Number.isInteger(fiscalYear) || (type !== 'closing' && type !== 'opening'))
    return NextResponse.json({ error: 'fiscalYear / type が必要です' }, { status: 400 })

  const { data: dup } = await supabaseAdmin
    .from('inventory_snapshots').select('id')
    .eq('fiscal_year', fiscalYear).eq('snapshot_type', type).maybeSingle()
  if (dup) return NextResponse.json({ error: 'すでに作成済みです（先に取消してから再生成してください）' }, { status: 409 })

  const { data: items } = await supabaseAdmin
    .from('items').select('id, current_quantity, cost_price')
    .eq('track_inventory', true).eq('is_active', true)
  const inputs = (items ?? []).map(i => ({
    itemId: i.id, quantity: Number(i.current_quantity), costPrice: i.cost_price,
  }))
  const snap = buildSnapshotLines(inputs)

  const { data: accs } = await supabaseAdmin
    .from('accounts').select('id, code').in('code', REQUIRED_CODES)
  const accountMap: Record<string, string> = {}
  for (const a of accs ?? []) accountMap[a.code] = a.id
  for (const code of REQUIRED_CODES) {
    if (!accountMap[code]) return NextResponse.json({ error: `必要な勘定科目（${code}）が見つかりません` }, { status: 400 })
  }

  const { data: snapshot, error: sErr } = await supabaseAdmin
    .from('inventory_snapshots')
    .insert({ fiscal_year: fiscalYear, snapshot_type: type, total_value: snap.totalValue })
    .select().single()
  if (sErr || !snapshot) return NextResponse.json({ error: sErr?.message ?? 'スナップショット作成失敗' }, { status: 500 })

  if (snap.lines.length > 0) {
    await supabaseAdmin.from('inventory_snapshot_lines').insert(
      snap.lines.map(l => ({ snapshot_id: snapshot.id, item_id: l.itemId, quantity: l.quantity, cost_price: l.costPrice, value: l.value })),
    )
  }

  let journalEntryId: string | null = null
  const entry = buildSnapshotJournal(snap.totalValue, fiscalYear, type, accountMap)
  if (entry) {
    const err = validateEntry(entry)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    const { data: header } = await supabaseAdmin
      .from('journal_entries').insert({
        entry_date: entry.entryDate, description: entry.description,
        source: 'inventory_snapshot', source_id: snapshot.id,
      }).select().single()
    if (header) {
      journalEntryId = header.id
      await supabaseAdmin.from('journal_lines').insert(
        entry.lines.map((l, i) => ({
          journal_entry_id: header.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
        })),
      )
      await supabaseAdmin.from('inventory_snapshots').update({ journal_entry_id: header.id }).eq('id', snapshot.id)
    }
  }

  return NextResponse.json({
    snapshot: { ...snapshot, journal_entry_id: journalEntryId },
    totalValue: snap.totalValue, missingCostCount: snap.missingCostCount,
  }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const { data: snap } = await supabaseAdmin.from('inventory_snapshots').select('journal_entry_id').eq('id', id).maybeSingle()
  if (snap?.journal_entry_id) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', snap.journal_entry_id)
  }
  const { error } = await supabaseAdmin.from('inventory_snapshots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
