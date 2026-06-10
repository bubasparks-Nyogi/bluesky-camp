import { describe, it, expect } from 'vitest'
import { buildSaleEntry } from '../saleEntry'
import { validateEntry } from '../validateEntry'

const MAP = { '103': 'id-ar', '401': 'id-sales' }

describe('buildSaleEntry', () => {
  it('builds a balanced sale entry', () => {
    const entry = buildSaleEntry({
      saleLineId: 's1', itemName: 'BBQセット', unitPrice: 3000, quantity: 2, occurredAt: '2026-08-15',
    }, MAP)!
    expect(entry.entryDate).toBe('2026-08-15')
    expect(entry.description).toBe('売上 BBQセット')
    expect(entry.lines).toEqual([
      { accountId: 'id-ar',    side: 'debit',  amount: 6000 },
      { accountId: 'id-sales', side: 'credit', amount: 6000 },
    ])
    expect(validateEntry(entry)).toBeNull()
  })

  it('rounds fractional yen', () => {
    const entry = buildSaleEntry({
      saleLineId: 's2', itemName: 'ビール', unitPrice: 500, quantity: 1.5, occurredAt: '2026-08-15',
    }, MAP)!
    expect(entry.lines[0].amount).toBe(750)
    expect(entry.lines[1].amount).toBe(750)
    expect(validateEntry(entry)).toBeNull()
  })

  it('returns null for zero amount', () => {
    expect(buildSaleEntry({
      saleLineId: 's', itemName: 'x', unitPrice: 0, quantity: 1, occurredAt: '2026-08-15',
    }, MAP)).toBeNull()
    expect(buildSaleEntry({
      saleLineId: 's', itemName: 'x', unitPrice: 100, quantity: 0, occurredAt: '2026-08-15',
    }, MAP)).toBeNull()
  })

  it('returns null for negative amount', () => {
    expect(buildSaleEntry({
      saleLineId: 's', itemName: 'x', unitPrice: 100, quantity: -1, occurredAt: '2026-08-15',
    }, MAP)).toBeNull()
  })
})
