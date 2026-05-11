// lib/payment.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createPaymentIntent } from './payment'

// Stripe をモック
vi.mock('stripe', () => {
  const MockStripe = function (this: any) {
    this.paymentIntents = {
      create: vi.fn().mockResolvedValue({
        id:            'pi_test_123',
        client_secret: 'pi_test_123_secret_abc',
        amount:        40000,
        currency:      'jpy',
      }),
    }
    this.webhooks = { constructEvent: vi.fn() }
  }
  return { default: MockStripe }
})

describe('createPaymentIntent', () => {
  it('金額・通貨・メタデータを受け取りclient_secretを返す', async () => {
    const result = await createPaymentIntent({
      amount:      40000,
      currency:    'jpy',
      description: 'テスト予約',
      metadata:    { reservationId: 'test-id' },
    })
    expect(result.clientSecret).toBe('pi_test_123_secret_abc')
    expect(result.paymentIntentId).toBe('pi_test_123')
  })
})
