import { describe, it, expect } from 'vitest'
import { reservationFormSchema } from '../reservation'

const valid = {
  checkinDate: '2026-07-15',
  checkoutDate: '2026-07-16',
  stayTypes: ['tent'] as const,
  ehu: false,
  sauna: false,
  pet: false,
  transferCount: 0,
  transferStation: '',
  rentalItems: [],
  guestName: '山田 太郎',
  guestEmail: 'taro@example.com',
  guestPhone: '090-1234-5678',
}

describe('reservationFormSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(reservationFormSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects malformed date', () => {
    const r = reservationFormSchema.safeParse({ ...valid, checkinDate: '2026/07/15' })
    expect(r.success).toBe(false)
  })

  it('rejects empty stayTypes', () => {
    const r = reservationFormSchema.safeParse({ ...valid, stayTypes: [] })
    expect(r.success).toBe(false)
  })

  it('rejects unknown stayType', () => {
    const r = reservationFormSchema.safeParse({ ...valid, stayTypes: ['mansion'] as unknown as ['tent'] })
    expect(r.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const r = reservationFormSchema.safeParse({ ...valid, guestEmail: 'not-an-email' })
    expect(r.success).toBe(false)
  })

  it('rejects checkout <= checkin', () => {
    const r = reservationFormSchema.safeParse({ ...valid, checkoutDate: '2026-07-15' })
    expect(r.success).toBe(false)
  })

  it('rejects negative transferCount', () => {
    const r = reservationFormSchema.safeParse({ ...valid, transferCount: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects rentalItems with qty <= 0', () => {
    const r = reservationFormSchema.safeParse({ ...valid, rentalItems: [{ id: 'a', name: 'b', price: 100, qty: 0 }] })
    expect(r.success).toBe(false)
  })

  it('rejects invalid phone', () => {
    const r = reservationFormSchema.safeParse({ ...valid, guestPhone: 'abc' })
    expect(r.success).toBe(false)
  })

  it('trims and validates guestName', () => {
    const r = reservationFormSchema.safeParse({ ...valid, guestName: '   ' })
    expect(r.success).toBe(false)
  })
})
