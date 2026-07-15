export type ItemCategory = 'ingredient' | 'dish' | 'goods' | 'drink' | 'supply'
export type DisplayStatus = 'available' | 'sold_out' | 'coming_soon'

export interface ItemInput {
  name: string
  category: ItemCategory
  unit: string
  salePrice: number | null
  costPrice: number | null
  isSellable: boolean
  trackInventory: boolean
  taxRate?: number
  displayStatus?: DisplayStatus
  onMenuDisplay?: boolean
}

export interface ComponentCostLine {
  costPrice: number | null
  quantity: number
}

export interface ComponentEdge {
  parentId: string
  componentId: string
}
