import { NextRequest, NextResponse } from 'next/server'
import iconv from 'iconv-lite'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { yayoiExport, type JournalForExport } from '@/lib/accounting/csv/yayoiExport'
import { freeeExport } from '@/lib/accounting/csv/freeeExport'

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const format = req.nextUrl.searchParams.get('format')
  const year = Number(req.nextUrl.searchParams.get('year'))
  const monthRaw = req.nextUrl.searchParams.get('month')
  if (!year || isNaN(year) || (format !== 'yayoi' && format !== 'freee'))
    return new NextResponse('Bad Request', { status: 400 })

  const periodStart = monthRaw
    ? `${year}-${String(Number(monthRaw)).padStart(2, '0')}-01`
    : `${year}-01-01`
  const periodEnd = monthRaw
    ? lastDayOfMonth(year, Number(monthRaw))
    : `${year}-12-31`

  const { data: entries, error } = await supabaseAdmin
    .from('journal_entries')
    .select(`
      id, entry_date, description,
      journal_lines(side, amount, accounts(name))
    `)
    .gte('entry_date', periodStart)
    .lte('entry_date', periodEnd)
    .order('entry_date', { ascending: true })
  if (error) return new NextResponse(`Error: ${error.message}`, { status: 500 })

  const rows: JournalForExport[] = []
  for (const e of entries ?? []) {
    const lines = (e as unknown as { journal_lines: { side: 'debit'|'credit'; amount: number; accounts: { name: string } }[] }).journal_lines
    const debit = lines.find(l => l.side === 'debit')
    const credit = lines.find(l => l.side === 'credit')
    if (!debit || !credit) continue
    rows.push({
      entryDate: (e as { entry_date: string }).entry_date,
      description: (e as { description: string }).description,
      debitAccount: debit.accounts.name,
      debitAmount: debit.amount,
      creditAccount: credit.accounts.name,
      creditAmount: credit.amount,
    })
  }

  const suffix = monthRaw ? `_${year}_${String(Number(monthRaw)).padStart(2, '0')}` : `_${year}`

  if (format === 'yayoi') {
    const csv = yayoiExport(rows)
    const buf = iconv.encode(csv, 'Shift_JIS')
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'text/csv; charset=shift_jis',
        'Content-Disposition': `attachment; filename="yayoi${suffix}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  const csv = freeeExport(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="freee${suffix}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
