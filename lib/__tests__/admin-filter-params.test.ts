import { describe, it, expect } from 'vitest'
import { nonEmpty, buildSearch } from '../admin-filter-params'

describe('nonEmpty', () => {
  it('returns undefined for undefined', () => {
    expect(nonEmpty(undefined)).toBeUndefined()
  })
  it('returns undefined for empty string', () => {
    expect(nonEmpty('')).toBeUndefined()
  })
  it('returns undefined for whitespace only', () => {
    expect(nonEmpty('   ')).toBeUndefined()
  })
  it('returns undefined for "all"', () => {
    expect(nonEmpty('all')).toBeUndefined()
  })
  it('returns trimmed value otherwise', () => {
    expect(nonEmpty('  hello  ')).toBe('hello')
  })
})

describe('buildSearch', () => {
  it('returns empty for all undefined', () => {
    expect(buildSearch({ q: undefined, s: undefined })).toBe('')
  })
  it('skips undefined and empty values', () => {
    expect(buildSearch({ q: 'a', s: undefined, t: '' })).toBe('?q=a')
  })
  it('serializes multiple params', () => {
    expect(buildSearch({ q: 'a', s: 'confirmed' })).toBe('?q=a&s=confirmed')
  })
})
