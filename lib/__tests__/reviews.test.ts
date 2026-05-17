import { describe, it, expect } from 'vitest'

// Validation logic mirroring what the API will do
function validateReview(body: Record<string, unknown>): string | null {
  if (!body.guest_name || typeof body.guest_name !== 'string' || (body.guest_name as string).trim().length === 0) {
    return 'guest_name が必要です'
  }
  if (!body.comment || typeof body.comment !== 'string' || (body.comment as string).trim().length === 0) {
    return 'comment が必要です'
  }
  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 'rating は 1〜5 の整数で指定してください'
  }
  return null
}

describe('validateReview', () => {
  it('returns null for valid review', () => {
    expect(validateReview({ guest_name: '田中太郎', comment: '最高でした', rating: 5 })).toBeNull()
  })

  it('rejects missing guest_name', () => {
    expect(validateReview({ comment: '最高', rating: 4 })).toBe('guest_name が必要です')
  })

  it('rejects empty guest_name', () => {
    expect(validateReview({ guest_name: '  ', comment: '最高', rating: 4 })).toBe('guest_name が必要です')
  })

  it('rejects missing comment', () => {
    expect(validateReview({ guest_name: '田中', rating: 3 })).toBe('comment が必要です')
  })

  it('rejects rating out of range (0)', () => {
    expect(validateReview({ guest_name: '田中', comment: 'ok', rating: 0 })).toBe('rating は 1〜5 の整数で指定してください')
  })

  it('rejects rating out of range (6)', () => {
    expect(validateReview({ guest_name: '田中', comment: 'ok', rating: 6 })).toBe('rating は 1〜5 の整数で指定してください')
  })

  it('rejects non-integer rating', () => {
    expect(validateReview({ guest_name: '田中', comment: 'ok', rating: 4.5 })).toBe('rating は 1〜5 の整数で指定してください')
  })
})
