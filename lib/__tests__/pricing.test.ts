// lib/__tests__/pricing.test.ts
import { describe, it, expect } from 'vitest'
import { calcTotal } from '../pricing'
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

describe('calcTotal - repeater discount (Phase 14)', () => {
  it('isRepeater 未指定の場合は既存のベースライン合計', () => {
    expect(calcTotal(base as ReservationFormData, basePricing)).toBe(15000)
  })

  it('isRepeater: false を明示しても割引なし', () => {
    expect(
      calcTotal(base as ReservationFormData, basePricing, { isRepeater: false }),
    ).toBe(15000)
  })

  it('isRepeater: true で10%割引（テント1泊: 15000 → 13500）', () => {
    const baseline = calcTotal(base as ReservationFormData, basePricing)
    expect(
      calcTotal(base as ReservationFormData, basePricing, { isRepeater: true }),
    ).toBe(Math.floor(baseline * 0.9))
  })

  it('isRepeater: true で複数泊・複合タイプも10%割引（テント+トレーラーA 2泊: 78000 → 70200）', () => {
    const form = { ...base, checkoutDate: '2026-07-03', stayTypes: ['tent', 'trailer_a'] }
    const baseline = calcTotal(form as ReservationFormData, basePricing)
    expect(baseline).toBe(78000)
    expect(
      calcTotal(form as ReservationFormData, basePricing, { isRepeater: true }),
    ).toBe(Math.floor(baseline * 0.9))
  })

  it('isRepeater: true で送迎・レンタル込みも10%割引（Math.floor で端数切り捨て）', () => {
    const form = {
      ...base,
      transferCount: 2,
      rentalItems: [{ id: '1', name: '焚き火台', price: 555, qty: 1 }],
    }
    const baseline = calcTotal(form as ReservationFormData, basePricing)
    expect(
      calcTotal(form as ReservationFormData, basePricing, { isRepeater: true }),
    ).toBe(Math.floor(baseline * 0.9))
  })
})
