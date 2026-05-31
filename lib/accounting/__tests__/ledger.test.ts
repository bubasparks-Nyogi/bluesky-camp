import { describe, it, expect } from 'vitest'
import { computeLedger } from '../ledger'
import type { Account } from '../types'
import type { PostedEntry } from '../ledger'

const acc = (id: string, normalBalance: Account['normalBalance']): Account => ({
  id, code: id, name: id, category: normalBalance === 'debit' ? 'asset' : 'liability',
  normalBalance, isActive: true, sortOrder: 0,
})

const cash    = acc('cash', 'debit')
const payable = acc('pay',  'credit')

describe('computeLedger', () => {
  it('accumulates running balance for a debit-normal account', () => {
    const entries: PostedEntry[] = [
      { date: '2026-01-10', description: 'sale', lines: [
        { accountId: 'cash', side: 'debit',  amount: 10000, accountName: 'cash' },
        { accountId: 'sal',  side: 'credit', amount: 10000, accountName: 'sales' },
      ]},
      { date: '2026-01-12', description: 'buy', lines: [
        { accountId: 'exp',  side: 'debit',  amount: 3000, accountName: 'exp' },
        { accountId: 'cash', side: 'credit', amount: 3000, accountName: 'cash' },
      ]},
    ]
    const rows = computeLedger('cash', cash, entries, 0)
    expect(rows).toHaveLength(2)
    expect(rows[0].debit).toBe(10000)
    expect(rows[0].balance).toBe(10000)
    expect(rows[0].counterAccountName).toBe('sales')
    expect(rows[1].credit).toBe(3000)
    expect(rows[1].balance).toBe(7000)
  })

  it('uses 諸口 for compound entries (3+ lines)', () => {
    const entries: PostedEntry[] = [
      { date: '2026-02-01', description: 'split', lines: [
        { accountId: 'cash', side: 'debit',  amount: 5000, accountName: 'cash' },
        { accountId: 'a',    side: 'credit', amount: 3000, accountName: 'A' },
        { accountId: 'b',    side: 'credit', amount: 2000, accountName: 'B' },
      ]},
    ]
    const rows = computeLedger('cash', cash, entries, 0)
    expect(rows[0].counterAccountName).toBe('諸口')
  })

  it('credit-normal account increases on credit', () => {
    const entries: PostedEntry[] = [
      { date: '2026-01-05', description: 'borrow', lines: [
        { accountId: 'cash', side: 'debit',  amount: 8000, accountName: 'cash' },
        { accountId: 'pay',  side: 'credit', amount: 8000, accountName: 'payable' },
      ]},
    ]
    const rows = computeLedger('pay', payable, entries, 0)
    expect(rows[0].balance).toBe(8000)
  })

  it('starts from opening balance', () => {
    const rows = computeLedger('cash', cash, [], 5000)
    expect(rows).toHaveLength(0)
  })
})
