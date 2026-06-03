import { describe, it, expect } from 'vitest'
import { validateItem, validateComponent } from '../validate'
import type { ItemInput } from '../types'

const base: ItemInput = {
  name: '国産牛肉', category: 'ingredient', unit: 'g',
  salePrice: null, costPrice: 1200, isSellable: false, trackInventory: true,
}

describe('validateItem', () => {
  it('returns null for a valid item', () => {
    expect(validateItem(base)).toBeNull()
  })
  it('rejects empty name', () => {
    expect(validateItem({ ...base, name: '  ' })).toBe('名称を入力してください')
  })
  it('rejects invalid category', () => {
    expect(validateItem({ ...base, category: 'xxx' as never })).toBe('カテゴリが不正です')
  })
  it('rejects negative or non-integer price', () => {
    expect(validateItem({ ...base, costPrice: -1 })).toBe('金額は0以上の整数で入力してください')
    expect(validateItem({ ...base, costPrice: 1.5 })).toBe('金額は0以上の整数で入力してください')
  })
  it('requires salePrice when sellable', () => {
    expect(validateItem({ ...base, isSellable: true, salePrice: null })).toBe('販売する品目は販売価格を入力してください')
  })
  it('accepts sellable item with salePrice', () => {
    expect(validateItem({ ...base, category: 'dish', isSellable: true, salePrice: 3000 })).toBeNull()
  })
})

describe('validateComponent', () => {
  it('returns null for valid component', () => {
    expect(validateComponent('a', 'b', 200)).toBeNull()
  })
  it('rejects self reference', () => {
    expect(validateComponent('a', 'a', 1)).toBe('自分自身を構成食材にできません')
  })
  it('rejects non-positive quantity', () => {
    expect(validateComponent('a', 'b', 0)).toBe('数量は正の数で入力してください')
    expect(validateComponent('a', 'b', -2)).toBe('数量は正の数で入力してください')
  })
})
