import { describe, it, expect } from 'vitest'
import { slugify } from '../slug'

describe('slugify', () => {
  it('converts simple English title', () => {
    expect(slugify('Summer Event 2026')).toBe('summer-event-2026')
  })

  it('trims and lowercases', () => {
    expect(slugify('  HELLO World  ')).toBe('hello-world')
  })

  it('collapses multiple spaces and underscores', () => {
    expect(slugify('hello   __world')).toBe('hello-world')
  })

  it('drops special characters', () => {
    expect(slugify('Foo!@#$ Bar?')).toBe('foo-bar')
  })

  it('returns timestamp fallback for Japanese-only title', () => {
    const result = slugify('夏のイベント')
    expect(result).toMatch(/^post-[a-z0-9]+$/)
  })

  it('handles mixed Japanese + English', () => {
    expect(slugify('Summer 夏 Event')).toBe('summer-event')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify('---hello---')).toBe('hello')
  })
})
