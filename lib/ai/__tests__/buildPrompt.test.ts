import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../buildPrompt'

const items = [
  { id: 'itm-001', name: 'アサヒスーパードライ', unit_price: 500 },
  { id: 'itm-002', name: 'コーラ',             unit_price: 300 },
]

const messages = [
  { sender: 'customer' as const, text: 'ビール2本ください', received_at: '2026-06-20T14:30:00Z' },
  { sender: 'owner'    as const, text: 'アサヒでよろしいですか？', received_at: '2026-06-20T14:31:00Z' },
  { sender: 'customer' as const, text: 'はい', received_at: '2026-06-20T14:32:00Z' },
]

describe('buildPrompt', () => {
  it('includes the system instructions', () => {
    const { system } = buildPrompt({ items, messages })
    expect(system).toContain('@blueSky')
    expect(system).toContain('注文')
    expect(system).toContain('空配列')
  })

  it('formats items as a bulleted list with id, name, price', () => {
    const { user } = buildPrompt({ items, messages })
    expect(user).toContain('itm-001')
    expect(user).toContain('アサヒスーパードライ')
    expect(user).toContain('500')
    expect(user).toContain('itm-002')
  })

  it('formats messages oldest first with sender prefix', () => {
    const { user } = buildPrompt({ items, messages })
    const idxFirst = user.indexOf('ビール2本')
    const idxLast  = user.indexOf('はい')
    expect(idxFirst).toBeGreaterThan(0)
    expect(idxLast).toBeGreaterThan(idxFirst)
    expect(user).toContain('[customer')
    expect(user).toContain('[owner')
  })

  it('returns empty messages section when no messages', () => {
    const { user } = buildPrompt({ items, messages: [] })
    expect(user).toContain('=== recent messages')
    expect(user).not.toContain('[customer')
  })
})
