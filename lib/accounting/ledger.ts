import type { Account, Side } from './types'

export interface PostedEntryLine {
  accountId: string
  side: Side
  amount: number
  accountName: string
}

export interface PostedEntry {
  date: string
  description: string
  lines: PostedEntryLine[]
}

export interface LedgerRow {
  date: string
  entryDescription: string
  counterAccountName: string | null
  debit: number
  credit: number
  balance: number
}

export function computeLedger(
  accountId: string,
  account: Account,
  entries: PostedEntry[],
  openingBalance: number,
): LedgerRow[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  let balance = openingBalance
  const rows: LedgerRow[] = []

  for (const entry of sorted) {
    for (const line of entry.lines) {
      if (line.accountId !== accountId) continue

      const others = entry.lines.filter(l => l.accountId !== accountId)
      const counterAccountName = others.length === 1 ? others[0].accountName : '諸口'

      const debit  = line.side === 'debit'  ? line.amount : 0
      const credit = line.side === 'credit' ? line.amount : 0

      if (account.normalBalance === 'debit') balance += debit - credit
      else                                   balance += credit - debit

      rows.push({
        date: entry.date,
        entryDescription: entry.description,
        counterAccountName,
        debit, credit, balance,
      })
    }
  }
  return rows
}
