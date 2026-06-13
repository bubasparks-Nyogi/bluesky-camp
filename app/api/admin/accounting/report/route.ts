import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { aggregatePeriod, type JournalLineRow } from '@/lib/accounting/aggregatePeriod'
import { applyTaxMapping } from '@/lib/accounting/applyTaxMapping'

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = Number(req.nextUrl.searchParams.get('year'))
  const monthRaw = req.nextUrl.searchParams.get('month')
  if (!year || isNaN(year)) return NextResponse.json({ error: 'year required' }, { status: 400 })

  const periodStart = monthRaw
    ? `${year}-${String(Number(monthRaw)).padStart(2, '0')}-01`
    : `${year}-01-01`
  const periodEnd = monthRaw
    ? lastDayOfMonth(year, Number(monthRaw))
    : `${year}-12-31`

  const { data, error } = await supabaseAdmin
    .from('journal_lines')
    .select(`
      side, amount,
      journal_entries!inner(entry_date),
      accounts!inner(id, code, name, category, normal_balance)
    `)
    .lte('journal_entries.entry_date', periodEnd)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lines: JournalLineRow[] = (data ?? []).map((row: Record<string, unknown>) => {
    const e = row.journal_entries as { entry_date: string }
    const a = row.accounts as { id: string; code: string; name: string; category: JournalLineRow['account_category']; normal_balance: 'debit' | 'credit' }
    return {
      account_id: a.id,
      account_code: a.code,
      account_name: a.name,
      account_category: a.category,
      normal_balance: a.normal_balance,
      side: row.side as 'debit' | 'credit',
      amount: row.amount as number,
      entry_date: e.entry_date,
    }
  })

  const agg = aggregatePeriod(lines, periodStart, periodEnd)
  const report = applyTaxMapping(agg.accounts, agg.totals.netIncome)

  return NextResponse.json({
    period: { periodStart, periodEnd, year, month: monthRaw ? Number(monthRaw) : null },
    totals: agg.totals,
    report,
  })
}
