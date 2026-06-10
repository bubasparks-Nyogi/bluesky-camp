import { describe, it, expect } from 'vitest'
import { buildSnapshotLines, buildSnapshotJournal } from '../snapshot'
import { validateEntry } from '@/lib/accounting/validateEntry'

const MAP = { '105': 'id-mer', '501': 'id-pur' }

describe('buildSnapshotLines', () => {
  it('sums quantity × cost', () => {
    const r = buildSnapshotLines([
      { itemId: 'a', quantity: 10, costPrice: 200 },
      { itemId: 'b', quantity: 5,  costPrice: 300 },
    ])
    expect(r.lines.length).toBe(2)
    expect(r.lines[0].value).toBe(2000)
    expect(r.lines[1].value).toBe(1500)
    expect(r.totalValue).toBe(3500)
    expect(r.missingCostCount).toBe(0)
  })

  it('costPrice=null → value 0 and count', () => {
    const r = buildSnapshotLines([
      { itemId: 'a', quantity: 5, costPrice: null },
      { itemId: 'b', quantity: 5, costPrice: 100 },
    ])
    expect(r.lines.find(l => l.itemId === 'a')!.value).toBe(0)
    expect(r.totalValue).toBe(500)
    expect(r.missingCostCount).toBe(1)
  })

  it('quantity ≤ 0 is skipped', () => {
    const r = buildSnapshotLines([
      { itemId: 'a', quantity: 0,  costPrice: 100 },
      { itemId: 'b', quantity: -3, costPrice: 100 },
      { itemId: 'c', quantity: 1,  costPrice: 100 },
    ])
    expect(r.lines.length).toBe(1)
    expect(r.lines[0].itemId).toBe('c')
    expect(r.totalValue).toBe(100)
  })

  it('rounds fractional yen', () => {
    const r = buildSnapshotLines([{ itemId: 'a', quantity: 0.5, costPrice: 333 }])
    expect(r.lines[0].value).toBe(167)
    expect(r.totalValue).toBe(167)
  })
})

describe('buildSnapshotJournal', () => {
  it('closing → 借 繰越商品 / 貸 仕入高', () => {
    const e = buildSnapshotJournal(50000, 2026, 'closing', MAP)!
    expect(e.entryDate).toBe('2026-12-31')
    expect(e.description).toBe('期末商品棚卸高 2026年度')
    expect(e.lines).toEqual([
      { accountId: 'id-mer', side: 'debit',  amount: 50000 },
      { accountId: 'id-pur', side: 'credit', amount: 50000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })

  it('opening → 借 仕入高 / 貸 繰越商品 dated Jan 1', () => {
    const e = buildSnapshotJournal(50000, 2027, 'opening', MAP)!
    expect(e.entryDate).toBe('2027-01-01')
    expect(e.description).toBe('期首商品棚卸高 2027年度')
    expect(e.lines).toEqual([
      { accountId: 'id-pur', side: 'debit',  amount: 50000 },
      { accountId: 'id-mer', side: 'credit', amount: 50000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })

  it('returns null for zero totalValue', () => {
    expect(buildSnapshotJournal(0, 2026, 'closing', MAP)).toBeNull()
  })
})
