import { describe, it, expect } from 'vitest'
import { buildMovementDelta } from '../movement'

describe('buildMovementDelta - in', () => {
  it('positive value gives +delta', () => {
    expect(buildMovementDelta('in', 10, 0)).toEqual({ delta: 10 })
  })
  it('zero or negative is rejected', () => {
    expect(buildMovementDelta('in', 0, 0)).toEqual({ error: '入庫数は正の数で入力してください' })
    expect(buildMovementDelta('in', -1, 5)).toEqual({ error: '入庫数は正の数で入力してください' })
  })
})

describe('buildMovementDelta - disposal', () => {
  it('disposes within stock gives -delta', () => {
    expect(buildMovementDelta('disposal', 3, 10)).toEqual({ delta: -3 })
  })
  it('exactly current stock is allowed', () => {
    expect(buildMovementDelta('disposal', 10, 10)).toEqual({ delta: -10 })
  })
  it('exceeding stock is rejected', () => {
    expect(buildMovementDelta('disposal', 11, 10)).toEqual({ error: '在庫が足りません（現在庫 10）' })
  })
  it('zero or negative is rejected', () => {
    expect(buildMovementDelta('disposal', 0, 10)).toEqual({ error: '廃棄数は正の数で入力してください' })
  })
})

describe('buildMovementDelta - adjustment', () => {
  it('actual above current gives positive delta', () => {
    expect(buildMovementDelta('adjustment', 8, 5)).toEqual({ delta: 3 })
  })
  it('actual below current gives negative delta', () => {
    expect(buildMovementDelta('adjustment', 2, 5)).toEqual({ delta: -3 })
  })
  it('actual equals current gives zero', () => {
    expect(buildMovementDelta('adjustment', 5, 5)).toEqual({ delta: 0 })
  })
  it('negative actual is rejected', () => {
    expect(buildMovementDelta('adjustment', -1, 5)).toEqual({ error: '実数は0以上で入力してください' })
  })
})

describe('buildMovementDelta - invalid', () => {
  it('unknown type is rejected', () => {
    expect(buildMovementDelta('xxx' as never, 1, 0)).toEqual({ error: '不明な操作です' })
  })
})
