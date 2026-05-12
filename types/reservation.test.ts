// types/reservation.test.ts
import { describe, it, expect } from 'vitest'
import type { ReservationFormData } from './reservation'
import { STEP_LABELS } from './reservation'

describe('ReservationFormData 型チェック', () => {
  it('全フィールドを持つオブジェクトを受け入れる', () => {
    const data: ReservationFormData = {
      checkinDate:     '2026-07-01',
      checkoutDate:    '2026-07-02',
      stayType:        'trailer_a',
      ehu:             false,
      sauna:           true,
      pet:             false,
      transferCount:   0,
      transferStation: '',
      rentalItems:     [],
      guestName:       '山田 太郎',
      guestEmail:      'taro@example.com',
      guestPhone:      '090-1234-5678',
    }
    expect(data.stayType).toBe('trailer_a')
    expect(data.sauna).toBe(true)
  })
})

describe('STEP_LABELS', () => {
  it('10 ステップある', () => {
    expect(STEP_LABELS.length).toBe(10)
  })
  it('index 7 が 利用規約', () => {
    expect(STEP_LABELS[7]).toBe('利用規約')
  })
  it('index 8 が 金額確認', () => {
    expect(STEP_LABELS[8]).toBe('金額確認')
  })
  it('index 9 が 決済', () => {
    expect(STEP_LABELS[9]).toBe('決済')
  })
})
