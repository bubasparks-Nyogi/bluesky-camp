// types/reservation.test.ts
import { describe, it, expect } from 'vitest'
import type { ReservationFormData, RentalItem, PricingItem } from './reservation'

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
