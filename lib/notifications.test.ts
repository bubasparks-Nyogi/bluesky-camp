// lib/notifications.test.ts
import { describe, it, expect, vi } from 'vitest'
import { lineReply } from './notifications'

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
