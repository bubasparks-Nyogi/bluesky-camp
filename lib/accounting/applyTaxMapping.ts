import type { AccountSummary } from './aggregatePeriod'
import {
  PL_REVENUE, PL_PURCHASES, PL_TAX_CATEGORIES, BS_CATEGORIES,
  type BsCategory,
} from './taxMapping'

export interface TaxStyledReport {
  revenue:   { label: string; amount: number; accounts: AccountSummary[] }
  purchases: { label: string; amount: number; accounts: AccountSummary[] }
  expenses:  Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  bsAssets:      Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  bsLiabilities: Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  bsEquity:      Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  unmapped: AccountSummary[]
}

function matchBs(acc: AccountSummary, cat: BsCategory): boolean {
  if (cat.computed) return false
  if (cat.accountCodes && cat.accountCodes.includes(acc.code)) return true
  if (cat.codePrefix && acc.code.startsWith(cat.codePrefix)) return true
  return false
}

export function applyTaxMapping(summary: AccountSummary[], netIncome: number): TaxStyledReport {
  const revenueAccounts:   AccountSummary[] = []
  const purchasesAccounts: AccountSummary[] = []
  const expenseMap = new Map<string, { label: string; amount: number; accounts: AccountSummary[] }>()
  for (const c of PL_TAX_CATEGORIES) expenseMap.set(c.key, { label: c.label, amount: 0, accounts: [] })

  const bsMap = new Map<string, { label: string; section: BsCategory['section']; amount: number; accounts: AccountSummary[] }>()
  for (const c of BS_CATEGORIES) bsMap.set(c.key, { label: c.label, section: c.section, amount: 0, accounts: [] })

  const unmapped: AccountSummary[] = []

  for (const acc of summary) {
    if (acc.category === 'revenue') {
      if (PL_REVENUE.accountCodes.includes(acc.code)) revenueAccounts.push(acc)
      else unmapped.push(acc)
      continue
    }
    if (acc.category === 'expense') {
      if (PL_PURCHASES.accountCodes.includes(acc.code)) { purchasesAccounts.push(acc); continue }
      const cat = PL_TAX_CATEGORIES.find(c => c.accountCodes.includes(acc.code))
      if (cat) {
        const e = expenseMap.get(cat.key)!
        e.amount += acc.balance; e.accounts.push(acc)
      } else {
        unmapped.push(acc)
      }
      continue
    }
    const matched = BS_CATEGORIES.find(c => matchBs(acc, c))
    if (matched) {
      const b = bsMap.get(matched.key)!
      b.amount += acc.balance; b.accounts.push(acc)
    } else {
      unmapped.push(acc)
    }
  }

  const niCat = BS_CATEGORIES.find(c => c.computed === 'netIncome')
  if (niCat) {
    const b = bsMap.get(niCat.key)!
    b.amount = netIncome
  }

  const splitBs = (section: BsCategory['section']) =>
    BS_CATEGORIES
      .filter(c => c.section === section)
      .map(c => {
        const b = bsMap.get(c.key)!
        return { key: c.key, label: b.label, amount: b.amount, accounts: b.accounts }
      })

  return {
    revenue: {
      label: PL_REVENUE.label,
      amount: revenueAccounts.reduce((s, a) => s + a.balance, 0),
      accounts: revenueAccounts,
    },
    purchases: {
      label: PL_PURCHASES.label,
      amount: purchasesAccounts.reduce((s, a) => s + a.balance, 0),
      accounts: purchasesAccounts,
    },
    expenses: PL_TAX_CATEGORIES.map(c => {
      const e = expenseMap.get(c.key)!
      return { key: c.key, label: e.label, amount: e.amount, accounts: e.accounts }
    }),
    bsAssets:      splitBs('asset'),
    bsLiabilities: splitBs('liability'),
    bsEquity:      splitBs('equity'),
    unmapped,
  }
}
