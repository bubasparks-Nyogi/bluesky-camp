// lib/notifications.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lineReply, sendOwnerLineNotification } from './notifications'

global.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch

describe('lineReply', () => {
  it('LINE Push API を呼び出す', async () => {
    await expect(
      lineReply('user-123', 'テストメッセージ')
    ).resolves.not.toThrow()
    expect(fetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('sendOwnerLineNotification', () => {
  const reservation = {
    guest_name:   '山田 太郎',
    checkin_date: '2026-07-01',
    stay_type:    'trailer_a',
    total_amount: 25000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.OWNER_LINE_USER_ID
  })

  it('OWNER_LINE_USER_ID が設定されている場合 lineReply を呼び出す', async () => {
    process.env.OWNER_LINE_USER_ID = 'owner-line-id'
    await sendOwnerLineNotification(reservation)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('OWNER_LINE_USER_ID が未設定の場合 lineReply を呼び出さない', async () => {
    await sendOwnerLineNotification(reservation)
    expect(fetch).not.toHaveBeenCalled()
  })
})
