import { describe, it, expect } from 'vitest'

function deriveInitial(initialDate?: string) {
  if (!initialDate) {
    return { checkinDate: '', checkoutDate: '', step: 0 }
  }
  const next = new Date(initialDate)
  next.setDate(next.getDate() + 1)
  return {
    checkinDate: initialDate,
    checkoutDate: next.toISOString().slice(0, 10),
    step: 1,
  }
}

describe('deriveInitial', () => {
  it('returns empty form at step 0 when no date provided', () => {
    const result = deriveInitial()
    expect(result.checkinDate).toBe('')
    expect(result.checkoutDate).toBe('')
    expect(result.step).toBe(0)
  })

  it('pre-fills checkinDate and sets checkout to next day', () => {
    const result = deriveInitial('2026-08-15')
    expect(result.checkinDate).toBe('2026-08-15')
    expect(result.checkoutDate).toBe('2026-08-16')
    expect(result.step).toBe(1)
  })

  it('handles month boundary correctly (Aug 31 → Sep 1)', () => {
    const result = deriveInitial('2026-08-31')
    expect(result.checkinDate).toBe('2026-08-31')
    expect(result.checkoutDate).toBe('2026-09-01')
    expect(result.step).toBe(1)
  })

  it('handles year boundary correctly (Dec 31 → Jan 1)', () => {
    const result = deriveInitial('2026-12-31')
    expect(result.checkinDate).toBe('2026-12-31')
    expect(result.checkoutDate).toBe('2027-01-01')
    expect(result.step).toBe(1)
  })
})
