import type { ItemInput, ItemCategory } from './types'

const CATEGORIES: ItemCategory[] = ['ingredient', 'dish', 'goods', 'drink', 'supply']

function isValidMoney(v: number | null): boolean {
  return v == null || (Number.isInteger(v) && v >= 0)
}

export function validateItem(input: ItemInput): string | null {
  if (!input.name || input.name.trim().length === 0) return '名称を入力してください'
  if (!CATEGORIES.includes(input.category)) return 'カテゴリが不正です'
  if (!isValidMoney(input.salePrice) || !isValidMoney(input.costPrice))
    return '金額は0以上の整数で入力してください'
  if (input.isSellable && input.salePrice == null)
    return '販売する品目は販売価格を入力してください'
  return null
}

export function validateComponent(parentId: string, componentId: string, quantity: number): string | null {
  if (parentId === componentId) return '自分自身を構成食材にできません'
  if (!(typeof quantity === 'number' && quantity > 0)) return '数量は正の数で入力してください'
  return null
}
