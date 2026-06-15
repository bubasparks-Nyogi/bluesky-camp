import { describe, it, expect } from 'vitest'
import { seasonalMultiplierFor, type SeasonalRate } from '../seasonalMultiplier'

const rates: SeasonalRate[] = [
  { start_date: '2026-07-01', end_date: '2026-08-31', multiplier: 1.2 },
  { start_date: '2026-12-29', end_date: '2027-01-03', multiplier: 1.5 },
  { start_date: '2026-01-15', end_date: '2026-02-28', multiplier: 0.8 },
]

describe('seasonalMultiplierFor', () => {
  it('returns 1 when no rules match', () => {
    expect(seasonalMultiplierFor('2026-06-01', rates)).toBe(1)
  })

  it('returns matching multiplier in range', () => {
    expect(seasonalMultiplierFor('2026-07-15', rates)).toBe(1.2)
    expect(seasonalMultiplierFor('2026-02-10', rates)).toBe(0.8)
  })

  it('includes boundary dates (start and end)', () => {
    expect(seasonalMultiplierFor('2026-07-01', rates)).toBe(1.2)
    expect(seasonalMultiplierFor('2026-08-31', rates)).toBe(1.2)
  })

  it('returns 1 for empty rates', () => {
    expect(seasonalMultiplierFor('2026-07-15', [])).toBe(1)
  })

  it('prefers the rule with biggest delta from 1 when multiple overlap', () => {
    const overlap: SeasonalRate[] = [
      { start_date: '2026-08-10', end_date: '2026-08-20', multiplier: 1.2 },
      { start_date: '2026-08-13', end_date: '2026-08-17', multiplier: 1.5 },
    ]
    expect(seasonalMultiplierFor('2026-08-15', overlap)).toBe(1.5)
  })
})
