import { describe, it, expect } from 'vitest'
import { computeTrialBalance } from '../trialBalance'
import type { Account, OpeningBalance } from '../types'
import type { PostedLine } from '../trialBalance'

const acc = (id: string, category: Account['category'], normalBalance: Account['normalBalance']): Account => ({
  id, code: id, name: id, category, normalBalance, isActive: true, sortOrder: 0,
})

const cash    = acc('cash',  'asset',   'debit')
const sales   = acc('sales', 'revenue', 'credit')
const expense = acc('exp',   'expense', 'debit')

describe('computeTrialBalance', () => {
  it('sums debit/credit and computes normal-side balance', () => {
    const lines: PostedLine[] = [
      { accountId: 'cash',  side: 'debit',  amount: 10000 },
      { accountId: 'sales', side: 'credit', amount: 10000 },
    ]
    const result = computeTrialBalance([cash, sales], lines, [])
    const cashRow  = result.rows.find(r => r.account.id === 'cash')!
    const salesRow = result.rows.find(r => r.account.id === 'sales')!
    expect(cashRow.debitTotal).toBe(10000)
    expect(cashRow.balance).toBe(10000)
    expect(salesRow.creditTotal).toBe(10000)
    expect(salesRow.balance).toBe(10000)
    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(10000)
    expect(result.totalCredit).toBe(10000)
  })

  it('includes opening balances', () => {
    const opening: OpeningBalance[] = [{ accountId: 'cash', side: 'debit', amount: 5000 }]
    const result = computeTrialBalance([cash], [], opening)
    const cashRow = result.rows.find(r => r.account.id === 'cash')!
    expect(cashRow.debitTotal).toBe(5000)
    expect(cashRow.balance).toBe(5000)
  })

  it('flags unbalanced totals', () => {
    const lines: PostedLine[] = [
      { accountId: 'cash', side: 'debit',  amount: 10000 },
      { accountId: 'exp',  side: 'debit',  amount: 5000 },
    ]
    const result = computeTrialBalance([cash, expense], lines, [])
    expect(result.balanced).toBe(false)
  })

  it('counts orphan lines (account not in list) in totals so imbalance is caught', () => {
    const lines: PostedLine[] = [
      { accountId: 'cash',    side: 'debit',  amount: 10000 },
      { accountId: 'missing', side: 'credit', amount: 10000 },  // account not in accounts[]
    ]
    const result = computeTrialBalance([cash], lines, [])
    expect(result.totalDebit).toBe(10000)
    expect(result.totalCredit).toBe(10000)
    expect(result.balanced).toBe(true)
  })

  it('flags imbalance even when an orphan line would otherwise hide it', () => {
    const lines: PostedLine[] = [
      { accountId: 'cash',    side: 'debit',  amount: 10000 },
      { accountId: 'missing', side: 'credit', amount: 7000 },
    ]
    const result = computeTrialBalance([cash], lines, [])
    expect(result.balanced).toBe(false)
  })
})
