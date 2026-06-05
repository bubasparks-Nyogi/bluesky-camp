import { describe, it, expect } from 'vitest'
import { buildReceiptModel, buildCancellationFeeModel } from '../build'
import type { SaleLineRow } from '../types'
import type { PricingItem, ReservationRow } from '@/types/reservation'

const pricing: PricingItem[] = [
  { itemKey: 'base',       label: '宿泊基本料金',     amount: 24000, active: true },
  { itemKey: 'tent_base',  label: 'テント設営 基本料金', amount: 15000, active: true },
  { itemKey: 'sauna',      label: 'サウナ利用',       amount: 0,     active: true },
  { itemKey: 'pet',        label: 'ペット同伴',       amount: 0,     active: true },
  { itemKey: 'transfer',   label: '送迎（1名あたり）',  amount: 0,     active: true },
  { itemKey: 'ehu',        label: 'EHU',             amount: 0,     active: true },
]

const baseReservation = {
  id: '12345678-aaaa-bbbb-cccc-dddddddddddd',
  guest_name: '山田 太郎', guest_email: 't@example.com', guest_phone: '090',
  checkin_date: '2026-08-15', checkout_date: '2026-08-17',
  stay_type: 'tent', stay_types: ['tent'],
  sauna: false, pet: false, ehu: false,
  transfer_count: 0, transfer_station: null,
  rental_items: [{ id: 'l', name: 'ランタン', price: 500, qty: 2 }],
  total_amount: 31000, status: 'confirmed',
} as unknown as ReservationRow

describe('buildReceiptModel', () => {
  it('builds reservation lines + sales + grand total', () => {
    const sales: SaleLineRow[] = [
      { id: 's1', reservation_id: 'r', item_id: 'i1', item_name: 'BBQセット', unit_price: 3000, quantity: 2, occurred_at: '2026-08-15', note: null },
      { id: 's2', reservation_id: 'r', item_id: 'i2', item_name: 'ビール',    unit_price: 500,  quantity: 4, occurred_at: '2026-08-15', note: null },
    ]
    const m = buildReceiptModel(baseReservation, pricing, sales)
    expect(m.guestName).toBe('山田 太郎')
    expect(m.reservationShortId).toBe('12345678')
    expect(m.nights).toBe(2)
    expect(m.reservationSubtotal).toBe(31000)
    expect(m.repeaterDiscount).toBe(0)
    expect(m.salesSubtotal).toBe(3000*2 + 500*4)
    expect(m.grandTotal).toBe(31000 + (3000*2 + 500*4))
    expect(m.saleLines[0].amount).toBe(6000)
  })
  it('applies repeater discount line when isRepeater=true', () => {
    const m = buildReceiptModel(baseReservation, pricing, [], { isRepeater: true })
    expect(m.repeaterDiscount).toBe(31000 - Math.floor(31000 * 0.9))
    expect(m.grandTotal).toBe(31000 - m.repeaterDiscount)
  })
  it('works with zero sales', () => {
    const m = buildReceiptModel(baseReservation, pricing, [])
    expect(m.saleLines).toEqual([])
    expect(m.salesSubtotal).toBe(0)
    expect(m.grandTotal).toBe(m.reservationSubtotal)
  })
})

describe('buildCancellationFeeModel', () => {
  it('builds fee model', () => {
    const m = buildCancellationFeeModel(baseReservation, { fee: 15500, rate: 50, label: '合計金額の50%' }, '2026-08-13')
    expect(m.guestName).toBe('山田 太郎')
    expect(m.reservationShortId).toBe('12345678')
    expect(m.totalAmount).toBe(31000)
    expect(m.feeRate).toBe(50)
    expect(m.feeAmount).toBe(15500)
    expect(m.feeLabel).toBe('合計金額の50%')
    expect(m.cancelledAt).toBe('2026-08-13')
  })
})
