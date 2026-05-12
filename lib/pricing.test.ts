// lib/pricing.test.ts
import { describe, it, expect } from 'vitest'
import { calcTotal, calcNights } from './pricing'
import type { ReservationFormData } from '@/types/reservation'

const basePricing = [
  { itemKey: 'base',      label: '宿泊基本料金（トレーラー）', amount: 24000, active: true },
  { itemKey: 'tent_base', label: 'テント設営 基本料金',        amount: 15000, active: true },
  { itemKey: 'ehu',       label: 'EHU（電源フック）使用量料金制', amount: 0,  active: true },
  { itemKey: 'sauna',     label: 'サウナ利用',                 amount: 0,    active: true },
  { itemKey: 'pet',       label: 'ペット同伴',                 amount: 0,    active: true },
  { itemKey: 'transfer',  label: '送迎（1名あたり）',           amount: 1000, active: true },
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
  it('テント1泊で15000円', () => {
    expect(calcTotal(base as ReservationFormData, basePricing)).toBe(15000)
  })

  it('テント2泊で30000円', () => {
    const form = { ...base, checkoutDate: '2026-07-03' }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(30000)
  })

  it('トレーラーA 1泊で24000円', () => {
    const form = { ...base, stayTypes: ['trailer_a'] }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(24000)
  })

  it('テント+トレーラーA 1泊で39000円（15000+24000）', () => {
    const form = { ...base, stayTypes: ['tent', 'trailer_a'] }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(39000)
  })

  it('テント+トレーラーA 2泊で78000円', () => {
    const form = { ...base, checkoutDate: '2026-07-03', stayTypes: ['tent', 'trailer_a'] }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(78000)
  })

  it('サウナ+ペットは無料（テント15000円のまま）', () => {
    const form = { ...base, sauna: true, pet: true }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(15000)
  })

  it('送迎2名で17000円（テント15000+2000）', () => {
    const form = { ...base, transferCount: 2 }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(17000)
  })

  it('レンタル合計を加算する', () => {
    const form = {
      ...base,
      rentalItems: [
        { id: '1', name: '焚き火台', price: 500, qty: 2 },
        { id: '2', name: 'チェア',  price: 300, qty: 1 },
      ],
    }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(16300)
  })

  it('キャンピングカー+EHUは24000円（EHUは使用量料金制で自動加算なし）', () => {
    const form = { ...base, stayTypes: ['campervan'], ehu: true }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(24000)
  })

  it('EHUはキャンピングカーなしでも加算されない（使用量料金制）', () => {
    const form = { ...base, stayTypes: ['tent'], ehu: true }
    expect(calcTotal(form as ReservationFormData, basePricing)).toBe(15000)
  })
})
