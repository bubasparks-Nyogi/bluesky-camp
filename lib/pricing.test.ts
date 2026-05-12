// lib/pricing.test.ts
import { describe, it, expect } from 'vitest'
import { calcTotal, calcNights } from './pricing'
import type { ReservationFormData } from '@/types/reservation'

const basePricing = [
  { itemKey: 'base',     label: '基本', amount: 40000, active: true },
  { itemKey: 'ehu',      label: 'EHU',  amount: 1000,  active: true },
  { itemKey: 'sauna',    label: 'サウナ', amount: 2000, active: true },
  { itemKey: 'pet',      label: 'ペット', amount: 2000, active: true },
  { itemKey: 'transfer', label: '送迎',  amount: 1000,  active: true },
]

const base: Partial<ReservationFormData> = {
  checkinDate: '2026-07-01', checkoutDate: '2026-07-02',
  stayTypes: ['tent'], ehu: false, sauna: false,
  pet: false, transferCount: 0, rentalItems: [],
}

describe('calcNights', () => {
  it('1泊', () => expect(calcNights('2026-07-01', '2026-07-02')).toBe(1))
  it('3泊', () => expect(calcNights('2026-07-01', '2026-07-04')).toBe(3))
  it('空文字は1泊扱い', () => expect(calcNights('', '')).toBe(1))
})

describe('calcTotal', () => {
  it('1泊1タイプで基本料金40000円', () => {
    expect(calcTotal(base as ReservationFormData, basePricing)).toBe(40000)
  })

  it('2泊1タイプで80000円', () => {
    const form = { ...base, checkoutDate: '2026-07-03' }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(80000)
  })

  it('1泊2タイプで80000円', () => {
    const form = { ...base, stayTypes: ['tent', 'trailer_a'] }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(80000)
  })

  it('2泊2タイプで160000円', () => {
    const form = { ...base, checkoutDate: '2026-07-03', stayTypes: ['tent', 'trailer_a'] }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(160000)
  })

  it('サウナ+ペットは無料（40000円のまま）', () => {
    const form = { ...base, sauna: true, pet: true }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(40000)
  })

  it('送迎2名で42000円', () => {
    const form = { ...base, transferCount: 2 }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(42000)
  })

  it('レンタル合計を加算する', () => {
    const form = {
      ...base,
      rentalItems: [
        { id: '1', name: '焚き火台', price: 500, qty: 2 },
        { id: '2', name: 'チェア',  price: 300, qty: 1 },
      ],
    }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(41300)
  })

  it('キャンピングカー+EHUで41000円', () => {
    const form = { ...base, stayTypes: ['campervan'], ehu: true }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(41000)
  })

  it('EHUはキャンピングカーなしでは加算されない', () => {
    const form = { ...base, stayTypes: ['tent'], ehu: true }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(40000)
  })
})
