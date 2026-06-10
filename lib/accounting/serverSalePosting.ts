import { supabaseAdmin } from '@/lib/supabase'
import { buildSaleEntry, type SaleAccountMap } from './saleEntry'
import { validateEntry } from './validateEntry'

const REQUIRED_CODES = ['103', '401']

async function buildAccountMap(): Promise<SaleAccountMap> {
  const { data } = await supabaseAdmin.from('accounts').select('id, code').in('code', REQUIRED_CODES)
  const map: SaleAccountMap = {}
  for (const a of data ?? []) map[a.code] = a.id
  return map
}

export async function postSaleEntry(saleLine: {
  id: string
  item_name: string
  unit_price: number
  quantity: number
  occurred_at: string
}): Promise<void> {
  await deleteSaleEntry(saleLine.id)

  const accountMap = await buildAccountMap()
  for (const code of REQUIRED_CODES) {
    if (!accountMap[code]) {
      console.error(`postSaleEntry: account code ${code} not found, skipping`)
      return
    }
  }

  const entry = buildSaleEntry({
    saleLineId: saleLine.id,
    itemName: saleLine.item_name,
    unitPrice: saleLine.unit_price,
    quantity: Number(saleLine.quantity),
    occurredAt: saleLine.occurred_at,
  }, accountMap)
  if (!entry) return

  const err = validateEntry(entry)
  if (err) {
    console.error('postSaleEntry validateEntry failed:', err)
    return
  }

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      entry_date: entry.entryDate,
      description: entry.description,
      source: 'sale_line',
      source_id: saleLine.id,
    })
    .select().single()
  if (headerErr || !header) {
    console.error('postSaleEntry header insert failed:', headerErr)
    return
  }
  const lines = entry.lines.map((l, i) => ({
    journal_entry_id: header.id,
    account_id: l.accountId,
    side: l.side,
    amount: l.amount,
    line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    console.error('postSaleEntry lines insert failed:', linesErr)
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
  }
}

export async function deleteSaleEntry(saleLineId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('journal_entries').delete()
    .eq('source', 'sale_line').eq('source_id', saleLineId)
  if (error) console.error('deleteSaleEntry failed:', error)
}
