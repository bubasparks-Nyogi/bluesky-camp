import { describe, it, expect } from 'vitest'
import { resolveActiveReservation, type ActiveReservationRow } from '../resolveActiveReservation'

const rows: ActiveReservationRow[] = [
  { id: 'r1', checkin_date: '2026-06-10', checkout_date: '2026-06-12', created_at: '2026-05-01T00:00:00Z' },
  { id: 'r2', checkin_date: '2026-06-15', checkout_date: '2026-06-17', created_at: '2026-05-15T00:00:00Z' },
  { id: 'r3', checkin_date: '2026-07-01', checkout_date: '2026-07-03', created_at: '2026-06-01T00:00:00Z' },
]

describe('resolveActiveReservation', () => {
  it('returns the active reservation when today is within checkin..checkout', () => {
    expect(resolveActiveReservation('2026-06-11', rows)?.id).toBe('r1')
  })

  it('returns reservation on checkin day (inclusive)', () => {
    expect(resolveActiveReservation('2026-06-15', rows)?.id).toBe('r2')
  })

  it('returns reservation on checkout day (inclusive)', () => {
    expect(resolveActiveReservation('2026-06-17', rows)?.id).toBe('r2')
  })

  it('returns null when today is before all checkins', () => {
    expect(resolveActiveReservation('2026-06-09', rows)).toBeNull()
  })

  it('returns latest created_at if multiple match (overlap)', () => {
    const overlapping: ActiveReservationRow[] = [
      { id: 'old', checkin_date: '2026-06-10', checkout_date: '2026-06-20', created_at: '2026-05-01T00:00:00Z' },
      { id: 'new', checkin_date: '2026-06-15', checkout_date: '2026-06-18', created_at: '2026-06-01T00:00:00Z' },
    ]
    expect(resolveActiveReservation('2026-06-16', overlapping)?.id).toBe('new')
  })
})
