// lib/notifications.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendReservationNotifications } from './notifications'
import type { ReservationRow } from '@/types/reservation'

vi.mock('resend', () => {
  const mockSend = vi.fn().mockResolvedValue({ id: 'email-123', error: null })
  return {
    Resend: vi.fn(function() {
      this.emails = { send: mockSend }
    }),
  }
})

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as typeof fetch

const mockReservation: ReservationRow = {
  id:               'res-001',
  checkin_date:     '2026-07-01',
  checkout_date:    '2026-07-02',
  status:           'confirmed',
  stay_type:        'trailer_a',
  ehu:              false,
  sauna:            true,
  pet:              false,
  transfer_count:   2,
  transfer_station: '近江高島駅',
  rental_items:     [],
  guest_name:       '山田 太郎',
  guest_email:      'taro@example.com',
  guest_phone:      '090-1234-5678',
  total_amount:     45000,
  stripe_payment_id: 'pi_test_123',
  line_user_id:     null,
  created_at:       '2026-05-01T00:00:00Z',
}

describe('sendReservationNotifications', () => {
  it('エラーなく実行できる', async () => {
    await expect(
      sendReservationNotifications(mockReservation)
    ).resolves.not.toThrow()
  })
})
