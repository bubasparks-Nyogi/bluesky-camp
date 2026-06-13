export interface JournalLineRow {
  account_id: string
  account_code: string
  account_name: string
  account_category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normal_balance: 'debit' | 'credit'
  side: 'debit' | 'credit'
  amount: number
  entry_date: string
}

export interface AccountSummary {
  accountId: string
  code: string
  name: string
  category: JournalLineRow['account_category']
  debitTotal: number
  creditTotal: number
  balance: number
}

export interface AggregateResult {
  accounts: AccountSummary[]
  totals: {
    revenue: number
    expense: number
    netIncome: number
    assets: number
    liabilities: number
    equity: number
  }
}

const PL_CATEGORIES = new Set(['revenue', 'expense'])

export function aggregatePeriod(
  lines: JournalLineRow[],
  periodStart: string,
  periodEnd: string,
): AggregateResult {
  const byAccount = new Map<string, AccountSummary>()
  for (const l of lines) {
    const isPL = PL_CATEGORIES.has(l.account_category)
    if (isPL) {
      if (l.entry_date < periodStart || l.entry_date > periodEnd) continue
    } else {
      if (l.entry_date > periodEnd) continue
    }
    let acc = byAccount.get(l.account_id)
    if (!acc) {
      acc = {
        accountId: l.account_id,
        code: l.account_code,
        name: l.account_name,
        category: l.account_category,
        debitTotal: 0,
        creditTotal: 0,
        balance: 0,
      }
      byAccount.set(l.account_id, acc)
    }
    if (l.side === 'debit') acc.debitTotal += l.amount
    else                    acc.creditTotal += l.amount
  }

  const accounts: AccountSummary[] = []
  let revenue = 0, expense = 0, assets = 0, liabilities = 0, equity = 0
  for (const acc of Array.from(byAccount.values())) {
    const sample = lines.find(l => l.account_id === acc.accountId)!
    acc.balance = sample.normal_balance === 'debit'
      ? acc.debitTotal - acc.creditTotal
      : acc.creditTotal - acc.debitTotal
    if (acc.balance === 0) continue
    accounts.push(acc)
    if (acc.category === 'revenue')   revenue     += acc.balance
    if (acc.category === 'expense')   expense     += acc.balance
    if (acc.category === 'asset')     assets      += acc.balance
    if (acc.category === 'liability') liabilities += acc.balance
    if (acc.category === 'equity')    equity      += acc.balance
  }
  accounts.sort((a, b) => a.code.localeCompare(b.code))

  return {
    accounts,
    totals: { revenue, expense, netIncome: revenue - expense, assets, liabilities, equity },
  }
}
