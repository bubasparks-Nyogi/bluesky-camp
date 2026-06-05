import { describe, it, expect } from 'vitest'
import { computeQuantity } from '../quantity'

describe('computeQuantity', () => {
  it('sums deltas', () => {
    expect(computeQuantity([10, -2, 3])).toBe(11)
  })
  it('returns 0 for empty', () => {
    expect(computeQuantity([])).toBe(0)
  })
  it('handles decimals', () => {
    expect(computeQuantity([200.5, -0.5])).toBe(200)
  })
})
