import { describe, it, expect } from 'vitest'
import { calcCancellationFee } from './cancellation'

describe('calcCancellationFee', () => {
  const totalAmount = 24000

  it('7日以上前はキャンセル料0円', () => {
    const result = calcCancellationFee('2026-08-10', totalAmount, '2026-08-01')
    expect(result.fee).toBe(0)
    expect(result.rate).toBe(0)
    expect(result.label).toBe('無料')
  })

  it('ちょうど7日前は無料', () => {
    const result = calcCancellationFee('2026-08-08', totalAmount, '2026-08-01')
    expect(result.fee).toBe(0)
    expect(result.rate).toBe(0)
  })

  it('6日前は50%', () => {
    const result = calcCancellationFee('2026-08-07', totalAmount, '2026-08-01')
    expect(result.fee).toBe(12000)
    expect(result.rate).toBe(50)
    expect(result.label).toBe('合計金額の50%')
  })

  it('3日前は50%', () => {
    const result = calcCancellationFee('2026-08-04', totalAmount, '2026-08-01')
    expect(result.fee).toBe(12000)
    expect(result.rate).toBe(50)
  })

  it('2日前（前々日）は100%', () => {
    const result = calcCancellationFee('2026-08-03', totalAmount, '2026-08-01')
    expect(result.fee).toBe(24000)
    expect(result.rate).toBe(100)
    expect(result.label).toBe('合計金額の100%')
  })

  it('前日は100%', () => {
    const result = calcCancellationFee('2026-08-02', totalAmount, '2026-08-01')
    expect(result.fee).toBe(24000)
    expect(result.rate).toBe(100)
  })

  it('当日は100%', () => {
    const result = calcCancellationFee('2026-08-01', totalAmount, '2026-08-01')
    expect(result.fee).toBe(24000)
    expect(result.rate).toBe(100)
  })

  it('today 省略時は現在日付を使用（エラーにならない）', () => {
    const result = calcCancellationFee('2099-12-31', totalAmount)
    expect(result.fee).toBe(0)
    expect(result.rate).toBe(0)
  })
})
