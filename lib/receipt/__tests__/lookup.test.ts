import { describe, it, expect } from 'vitest'
import { matchReservation, determineIsReissue } from '../lookup'

describe('matchReservation', () => {
  const r = { id: 'abc-123', guest_email: 'taro@example.com' }
  it('returns true on exact match', () => {
    expect(matchReservation('abc-123', 'taro@example.com', r)).toBe(true)
  })
  it('normalizes email case', () => {
    expect(matchReservation('abc-123', 'Taro@Example.com', r)).toBe(true)
  })
  it('normalizes email whitespace', () => {
    expect(matchReservation('abc-123', '  taro@example.com  ', r)).toBe(true)
  })
  it('returns false on id mismatch', () => {
    expect(matchReservation('xxx', 'taro@example.com', r)).toBe(false)
  })
  it('returns false on email mismatch', () => {
    expect(matchReservation('abc-123', 'other@example.com', r)).toBe(false)
  })
  it('returns false on empty input', () => {
    expect(matchReservation('', 'taro@example.com', r)).toBe(false)
    expect(matchReservation('abc-123', '', r)).toBe(false)
  })
})

describe('determineIsReissue', () => {
  it('false for empty logs', () => {
    expect(determineIsReissue('receipt', [])).toBe(false)
  })
  it('false when only other-type logs exist', () => {
    expect(determineIsReissue('receipt', [{ type: 'cancellation_fee' }])).toBe(false)
  })
  it('true with 1 matching log', () => {
    expect(determineIsReissue('receipt', [{ type: 'receipt' }])).toBe(true)
  })
  it('true with multiple matching logs', () => {
    expect(determineIsReissue('receipt', [
      { type: 'receipt' }, { type: 'receipt' }, { type: 'cancellation_fee' },
    ])).toBe(true)
  })
})
