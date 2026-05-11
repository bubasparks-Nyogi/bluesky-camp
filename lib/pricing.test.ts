// lib/pricing.test.ts
import { describe, it, expect } from 'vitest'
import { calcTotal } from './pricing'
import type { ReservationFormData } from '@/types/reservation'

const basePricing = [
  { itemKey: 'base',     label: '基本', amount: 40000, active: true },
  { itemKey: 'ehu',      label: 'EHU',  amount: 1000,  active: true },
  { itemKey: 'sauna',    label: 'サウナ', amount: 2000, active: true },
  { itemKey: 'pet',      label: 'ペット', amount: 2000, active: true },
  { itemKey: 'transfer', label: '送迎',  amount: 1000,  active: true },
]

describe('calcTotal', () => {
  it('基本料金のみのとき40000円', () => {
    const form: Partial<ReservationFormData> = {
      stayType: 'tent', ehu: false, sauna: false,
      pet: false, transferCount: 0, rentalItems: [],
    }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(40000)
  })

  it('サウナ+ペットで44000円', () => {
    const form: Partial<ReservationFormData> = {
      stayType: 'tent', ehu: false, sauna: true,
      pet: true, transferCount: 0, rentalItems: [],
    }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(44000)
  })

  it('送迎2名で基本+2000円', () => {
    const form: Partial<ReservationFormData> = {
      stayType: 'tent', ehu: false, sauna: false,
      pet: false, transferCount: 2, rentalItems: [],
    }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(42000)
  })

  it('レンタル合計を加算する', () => {
    const form: Partial<ReservationFormData> = {
      stayType: 'tent', ehu: false, sauna: false,
      pet: false, transferCount: 0,
      rentalItems: [
        { id: '1', name: '焚き火台', price: 500, qty: 2 },
        { id: '2', name: 'チェア',  price: 300, qty: 1 },
      ],
    }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(41300)
  })

  it('キャンピングカー+EHUで41000円', () => {
    const form: Partial<ReservationFormData> = {
      stayType: 'campervan', ehu: true, sauna: false,
      pet: false, transferCount: 0, rentalItems: [],
    }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(41000)
  })
})
