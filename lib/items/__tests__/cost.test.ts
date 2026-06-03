import { describe, it, expect } from 'vitest'
import { computeDishCost } from '../cost'

describe('computeDishCost', () => {
  it('sums costPrice * quantity rounded to integer', () => {
    expect(computeDishCost([
      { costPrice: 1200, quantity: 0.2 },
      { costPrice: 300, quantity: 1 },
    ])).toEqual({ cost: 540, hasMissingCost: false })
  })
  it('flags missing cost (null) and treats it as 0', () => {
    expect(computeDishCost([
      { costPrice: null, quantity: 2 },
      { costPrice: 500, quantity: 1 },
    ])).toEqual({ cost: 500, hasMissingCost: true })
  })
  it('returns zero for empty', () => {
    expect(computeDishCost([])).toEqual({ cost: 0, hasMissingCost: false })
  })
  it('rounds fractional yen', () => {
    expect(computeDishCost([{ costPrice: 333, quantity: 0.5 }]).cost).toBe(167)
  })
})
