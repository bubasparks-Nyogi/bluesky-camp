import { describe, it, expect } from 'vitest'
import { applyTaxMapping } from '../applyTaxMapping'
import type { AccountSummary } from '../aggregatePeriod'

function sum(p: Partial<AccountSummary>): AccountSummary {
  return {
    accountId: p.accountId ?? 'a',
    code: p.code ?? '101',
    name: p.name ?? '現金',
    category: p.category ?? 'asset',
    debitTotal: p.debitTotal ?? 0,
    creditTotal: p.creditTotal ?? 0,
    balance: p.balance ?? 0,
  }
}

describe('applyTaxMapping', () => {
  it('aggregates revenue (401 + 402)', () => {
    const r = applyTaxMapping([
      sum({ code: '401', name: '売上高', category: 'revenue', balance: 5000 }),
      sum({ code: '402', name: '雑収入', category: 'revenue', balance: 1000 }),
    ], 0)
    expect(r.revenue.amount).toBe(6000)
  })

  it('aggregates expense to its tax category', () => {
    const r = applyTaxMapping([
      sum({ code: '512', name: '水道光熱費', category: 'expense', balance: 3000 }),
    ], 0)
    const utility = r.expenses.find(e => e.key === 'utility')
    expect(utility?.amount).toBe(3000)
  })

  it('puts unmapped expense codes into unmapped (not silently in 雑費)', () => {
    const r = applyTaxMapping([
      sum({ code: '999', name: '謎経費', category: 'expense', balance: 500 }),
    ], 0)
    expect(r.unmapped.map(u => u.code)).toContain('999')
  })

  it('matches fixedAssets via codePrefix "15"', () => {
    const r = applyTaxMapping([
      sum({ code: '152', name: '建物', category: 'asset', balance: 100000 }),
      sum({ code: '153', name: '車両運搬具', category: 'asset', balance: 50000 }),
    ], 0)
    const fixed = r.bsAssets.find(a => a.key === 'fixedAssets')
    expect(fixed?.amount).toBe(150000)
  })

  it('places netIncome into bsEquity', () => {
    const r = applyTaxMapping([], 250000)
    const ni = r.bsEquity.find(e => e.key === 'netIncome')
    expect(ni?.amount).toBe(250000)
  })
})
