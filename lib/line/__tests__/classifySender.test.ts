import { describe, it, expect, vi } from 'vitest'
import { classifySender } from '../classifySender'

describe('classifySender', () => {
  it('returns "owner" when lineUserId matches ownerLineUserId', () => {
    expect(classifySender('U_OWNER', 'U_OWNER')).toBe('owner')
  })

  it('returns "customer" when lineUserId does not match', () => {
    expect(classifySender('U_CUSTOMER', 'U_OWNER')).toBe('customer')
  })

  it('returns "customer" and warns when ownerLineUserId is undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(classifySender('U_ANY', undefined)).toBe('customer')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
