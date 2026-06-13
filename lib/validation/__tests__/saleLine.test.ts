import { describe, it, expect } from 'vitest'
import { saleLineCreateSchema } from '../saleLine'

const UUID = 'a1b2c3d4-1234-4567-8901-abcdef123456'
const valid = { itemId: UUID, quantity: 2, occurredAt: '2026-07-15', note: 'メモ' }

describe('saleLineCreateSchema', () => {
  it('accepts valid input', () => {
    expect(saleLineCreateSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects non-UUID itemId', () => {
    expect(saleLineCreateSchema.safeParse({ ...valid, itemId: 'not-uuid' }).success).toBe(false)
  })
  it('rejects zero quantity', () => {
    expect(saleLineCreateSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false)
  })
  it('rejects malformed date', () => {
    expect(saleLineCreateSchema.safeParse({ ...valid, occurredAt: '2026/07/15' }).success).toBe(false)
  })
  it('allows omitting note', () => {
    const { note, ...rest } = valid
    void note
    expect(saleLineCreateSchema.safeParse(rest).success).toBe(true)
  })
})
