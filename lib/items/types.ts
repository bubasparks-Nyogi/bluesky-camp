export type ItemCategory = 'ingredient' | 'dish' | 'goods' | 'drink' | 'supply'

export interface ItemInput {
  name: string
  category: ItemCategory
  unit: string
  salePrice: number | null
  costPrice: number | null
  isSellable: boolean
  trackInventory: boolean
  taxRate?: number
}

export interface ComponentCostLine {
  costPrice: number | null
  quantity: number
}

export interface ComponentEdge {
  parentId: string
  componentId: string
}
