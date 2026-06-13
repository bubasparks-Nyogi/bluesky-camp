import { describe, it, expect } from 'vitest'
import { computeReplySuffix } from '../computeReplySuffix'
import { shouldPushOwnerAlert } from '../shouldPushOwnerAlert'

describe('computeReplySuffix', () => {
  it('returns empty string for 0 pending drafts', () => {
    expect(computeReplySuffix(0)).toBe('')
  })

  it('appends note for 1-2 pending drafts', () => {
    expect(computeReplySuffix(1)).toContain('登録案 1 件')
    expect(computeReplySuffix(2)).toContain('登録案 2 件')
  })

  it('appends note for 3+ pending drafts', () => {
    expect(computeReplySuffix(5)).toContain('登録案 5 件')
  })
})

describe('shouldPushOwnerAlert', () => {
  it('returns true when count just reached 3 and no prior alert today', () => {
    expect(shouldPushOwnerAlert(3, false)).toBe(true)
  })

  it('returns false when count < 3', () => {
    expect(shouldPushOwnerAlert(2, false)).toBe(false)
  })

  it('returns false when already alerted today', () => {
    expect(shouldPushOwnerAlert(3, true)).toBe(false)
    expect(shouldPushOwnerAlert(10, true)).toBe(false)
  })
})
