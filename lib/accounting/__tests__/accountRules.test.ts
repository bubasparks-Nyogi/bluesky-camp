import { describe, it, expect } from 'vitest'
import { canDeleteAccount } from '../accountRules'

describe('canDeleteAccount', () => {
  it('allows deletion when account has no usage', () => {
    expect(canDeleteAccount('cash', ['sales', 'exp'])).toBe(true)
  })
  it('forbids deletion when account is used in a line', () => {
    expect(canDeleteAccount('cash', ['cash', 'sales'])).toBe(false)
  })
  it('allows deletion for empty usage list', () => {
    expect(canDeleteAccount('cash', [])).toBe(true)
  })
})
