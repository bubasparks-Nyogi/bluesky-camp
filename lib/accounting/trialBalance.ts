import type { Account, OpeningBalance, Side } from './types'

export interface PostedLine {
  accountId: string
  side: Side
  amount: number
}

export interface TrialBalanceRow {
  account: Account
  debitTotal: number
  creditTotal: number
  balance: number
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
}

export function computeTrialBalance(
  accounts: Account[],
  lines: PostedLine[],
  openingBalances: OpeningBalance[],
): TrialBalanceResult {
  const debitByAccount  = new Map<string, number>()
  const creditByAccount = new Map<string, number>()

  const add = (map: Map<string, number>, id: string, amount: number) =>
    map.set(id, (map.get(id) ?? 0) + amount)

  for (const ob of openingBalances) {
    if (ob.side === 'debit') add(debitByAccount, ob.accountId, ob.amount)
    else                     add(creditByAccount, ob.accountId, ob.amount)
  }
  for (const line of lines) {
    if (line.side === 'debit') add(debitByAccount, line.accountId, line.amount)
    else                       add(creditByAccount, line.accountId, line.amount)
  }

  const rows: TrialBalanceRow[] = accounts.map(account => {
    const debitTotal  = debitByAccount.get(account.id) ?? 0
    const creditTotal = creditByAccount.get(account.id) ?? 0
    const balance = account.normalBalance === 'debit'
      ? debitTotal - creditTotal
      : creditTotal - debitTotal
    return { account, debitTotal, creditTotal, balance }
  })

  const sumSide = (side: Side) =>
    openingBalances.filter(o => o.side === side).reduce((s, o) => s + o.amount, 0) +
    lines.filter(l => l.side === side).reduce((s, l) => s + l.amount, 0)

  const totalDebit  = sumSide('debit')
  const totalCredit = sumSide('credit')

  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit }
}
