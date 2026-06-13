import { describe, it, expect } from 'vitest'
import { aggregatePeriod, type JournalLineRow } from '../aggregatePeriod'

function line(p: Partial<JournalLineRow>): JournalLineRow {
  return {
    account_id: p.account_id ?? 'a',
    account_code: p.account_code ?? '101',
    account_name: p.account_name ?? '現金',
    account_category: p.account_category ?? 'asset',
    normal_balance: p.normal_balance ?? 'debit',
    side: p.side ?? 'debit',
    amount: p.amount ?? 0,
    entry_date: p.entry_date ?? '2026-06-15',
  }
}

describe('aggregatePeriod', () => {
  it('sums debit and credit for a single account within period', () => {
    const r = aggregatePeriod([
      line({ side: 'debit', amount: 1000, entry_date: '2026-06-10' }),
      line({ side: 'credit', amount: 300,  entry_date: '2026-06-12' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.accounts).toHaveLength(1)
    expect(r.accounts[0].debitTotal).toBe(1000)
    expect(r.accounts[0].creditTotal).toBe(300)
    expect(r.accounts[0].balance).toBe(700)
  })

  it('excludes P/L lines outside the period', () => {
    const r = aggregatePeriod([
      line({ account_code: '401', account_category: 'revenue', normal_balance: 'credit', side: 'credit', amount: 5000, entry_date: '2026-05-31' }),
      line({ account_code: '401', account_category: 'revenue', normal_balance: 'credit', side: 'credit', amount: 7000, entry_date: '2026-06-15' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.totals.revenue).toBe(7000)
  })

  it('B/S accounts accumulate from beginning (ignore periodStart)', () => {
    const r = aggregatePeriod([
      line({ account_code: '101', account_category: 'asset', normal_balance: 'debit', side: 'debit', amount: 1000, entry_date: '2026-01-15' }),
      line({ account_code: '101', account_category: 'asset', normal_balance: 'debit', side: 'debit', amount: 500,  entry_date: '2026-06-15' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.totals.assets).toBe(1500)
  })

  it('respects normal_balance (credit-side accounts)', () => {
    const r = aggregatePeriod([
      line({ account_code: '211', account_category: 'liability', normal_balance: 'credit', side: 'credit', amount: 2000, entry_date: '2026-06-10' }),
      line({ account_code: '211', account_category: 'liability', normal_balance: 'credit', side: 'debit',  amount: 500,  entry_date: '2026-06-20' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.accounts[0].balance).toBe(1500)
  })

  it('returns empty for empty input', () => {
    const r = aggregatePeriod([], '2026-06-01', '2026-06-30')
    expect(r.accounts).toEqual([])
    expect(r.totals).toEqual({ revenue: 0, expense: 0, netIncome: 0, assets: 0, liabilities: 0, equity: 0 })
  })

  it('excludes accounts with zero balance from result', () => {
    const r = aggregatePeriod([
      line({ account_id: 'A', side: 'debit', amount: 1000, entry_date: '2026-06-10' }),
      line({ account_id: 'A', side: 'credit', amount: 1000, entry_date: '2026-06-12' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.accounts).toEqual([])
  })
})
