import { describe, it, expect } from 'vitest'
import { buildReservationEntry, filterPostableReservations } from '../reservationPosting'
import type { ReservationForPosting, AccountCodeMap } from '../reservationPosting'
import { validateEntry } from '../validateEntry'

const MAP: AccountCodeMap = {
  '101': 'id-cash', '102': 'id-bank', '103': 'id-receivable',
  '203': 'id-advance', '401': 'id-sales', '402': 'id-misc',
}

const prepaid: ReservationForPosting = {
  id: 'r1', totalAmount: 20000, paymentMethod: 'prepaid',
  checkinDate: '2026-03-10', checkoutDate: '2026-03-11',
}
const onsite: ReservationForPosting = {
  id: 'r2', totalAmount: 15000, paymentMethod: 'onsite',
  checkinDate: '2026-03-10', checkoutDate: '2026-03-11',
}

describe('buildReservationEntry - prepayment', () => {
  it('prepaid → 借 普通預金 / 貸 前受金', () => {
    const e = buildReservationEntry(prepaid, 'prepayment', MAP, { paidAt: '2026-02-20' })!
    expect(e.entryDate).toBe('2026-02-20')
    expect(e.lines).toEqual([
      { accountId: 'id-bank',    side: 'debit',  amount: 20000 },
      { accountId: 'id-advance', side: 'credit', amount: 20000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('onsite → null', () => {
    expect(buildReservationEntry(onsite, 'prepayment', MAP, { paidAt: '2026-02-20' })).toBeNull()
  })
})

describe('buildReservationEntry - revenue', () => {
  it('prepaid → 借 前受金 / 貸 売上高 on checkout date', () => {
    const e = buildReservationEntry(prepaid, 'revenue', MAP)!
    expect(e.entryDate).toBe('2026-03-11')
    expect(e.lines).toEqual([
      { accountId: 'id-advance', side: 'debit',  amount: 20000 },
      { accountId: 'id-sales',   side: 'credit', amount: 20000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('onsite → 借 現金 / 貸 売上高', () => {
    const e = buildReservationEntry(onsite, 'revenue', MAP)!
    expect(e.lines).toEqual([
      { accountId: 'id-cash',  side: 'debit',  amount: 15000 },
      { accountId: 'id-sales', side: 'credit', amount: 15000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
})

describe('buildReservationEntry - cancellation', () => {
  it('prepaid + fee>0 → 借 前受金 / 貸 雑収入+普通預金, balanced', () => {
    const e = buildReservationEntry(prepaid, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 10000 })!
    expect(e.entryDate).toBe('2026-03-05')
    expect(e.lines).toEqual([
      { accountId: 'id-advance', side: 'debit',  amount: 20000 },
      { accountId: 'id-misc',    side: 'credit', amount: 10000 },
      { accountId: 'id-bank',    side: 'credit', amount: 10000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('prepaid + fee=total → no refund line', () => {
    const e = buildReservationEntry(prepaid, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 20000 })!
    expect(e.lines).toEqual([
      { accountId: 'id-advance', side: 'debit',  amount: 20000 },
      { accountId: 'id-misc',    side: 'credit', amount: 20000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('prepaid + fee=0 → no misc line (full refund)', () => {
    const e = buildReservationEntry(prepaid, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 0 })!
    expect(e.lines).toEqual([
      { accountId: 'id-advance', side: 'debit',  amount: 20000 },
      { accountId: 'id-bank',    side: 'credit', amount: 20000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('onsite + fee=0 → null', () => {
    expect(buildReservationEntry(onsite, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 0 })).toBeNull()
  })
  it('onsite + fee>0 → 借 売掛金 / 貸 雑収入', () => {
    const e = buildReservationEntry(onsite, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 7500 })!
    expect(e.lines).toEqual([
      { accountId: 'id-receivable', side: 'debit',  amount: 7500 },
      { accountId: 'id-misc',       side: 'credit', amount: 7500 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
})

describe('filterPostableReservations', () => {
  const base = {
    total_amount: 10000, payment_method: 'onsite', checkin_date: '2026-03-01',
    checkout_date: '2026-03-02', status: 'confirmed',
  }
  it('includes confirmed, past-checkout, payment set, not yet posted, not cancelled', () => {
    const rows = [{ id: 'a', ...base }]
    const out = filterPostableReservations(rows, '2026-03-10', new Set())
    expect(out.map(r => r.id)).toEqual(['a'])
  })
  it('excludes future checkout', () => {
    const rows = [{ id: 'a', ...base, checkout_date: '2026-12-31' }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set())).toHaveLength(0)
  })
  it('excludes non-confirmed', () => {
    const rows = [{ id: 'a', ...base, status: 'pending' }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set())).toHaveLength(0)
  })
  it('excludes missing payment_method', () => {
    const rows = [{ id: 'a', ...base, payment_method: null }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set())).toHaveLength(0)
  })
  it('excludes already-posted', () => {
    const rows = [{ id: 'a', ...base }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set(['a']))).toHaveLength(0)
  })
  it('excludes cancelled', () => {
    const rows = [{ id: 'a', ...base, status: 'cancelled' }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set())).toHaveLength(0)
  })
})
