import { describe, it, expect } from 'vitest'
import { weatherCodeToLabel, weatherCodeToIcon } from './weather'

describe('weatherCodeToLabel', () => {
  it('returns 晴れ for code 0', () => {
    expect(weatherCodeToLabel(0)).toBe('晴れ')
  })
  it('returns くもり for code 3', () => {
    expect(weatherCodeToLabel(3)).toBe('くもり')
  })
  it('returns 雨 for code 61', () => {
    expect(weatherCodeToLabel(61)).toBe('雨')
  })
  it('returns 雪 for code 71', () => {
    expect(weatherCodeToLabel(71)).toBe('雪')
  })
  it('returns 雷雨 for code 95', () => {
    expect(weatherCodeToLabel(95)).toBe('雷雨')
  })
  it('returns -- for unknown code', () => {
    expect(weatherCodeToLabel(999)).toBe('--')
  })
})

describe('weatherCodeToIcon', () => {
  it('returns ☀️ for code 0', () => {
    expect(weatherCodeToIcon(0)).toBe('☀️')
  })
  it('returns 🌧️ for code 61', () => {
    expect(weatherCodeToIcon(61)).toBe('🌧️')
  })
})
