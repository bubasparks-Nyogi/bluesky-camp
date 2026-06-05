import type { MovementType, DeltaResult } from './types'

export function buildMovementDelta(type: MovementType, value: number, currentQty: number): DeltaResult {
  if (type === 'in') {
    if (!(value > 0)) return { error: '入庫数は正の数で入力してください' }
    return { delta: value }
  }
  if (type === 'disposal') {
    if (!(value > 0)) return { error: '廃棄数は正の数で入力してください' }
    if (value > currentQty) return { error: `在庫が足りません（現在庫 ${currentQty}）` }
    return { delta: -value }
  }
  if (type === 'adjustment') {
    if (value < 0) return { error: '実数は0以上で入力してください' }
    return { delta: value - currentQty }
  }
  return { error: '不明な操作です' }
}
