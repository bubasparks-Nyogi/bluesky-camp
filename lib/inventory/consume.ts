export interface ItemLite {
  id: string
  category: 'ingredient' | 'dish' | 'goods' | 'drink' | 'supply'
  trackInventory: boolean
}

export interface ComponentLine {
  componentItemId: string
  quantity: number
}

export interface ConsumptionLine {
  itemId: string
  quantity: number
}

export function expandConsumption(params: {
  saleQuantity: number
  item: ItemLite
  components: ComponentLine[]
  itemLookup: Map<string, ItemLite>
}): ConsumptionLine[] {
  const { saleQuantity, item, components, itemLookup } = params
  if (!(saleQuantity > 0)) return []

  if (item.category === 'dish') {
    const lines: ConsumptionLine[] = []
    for (const c of components) {
      if (!(c.quantity > 0)) continue
      const comp = itemLookup.get(c.componentItemId)
      if (!comp) continue
      if (comp.trackInventory !== true) continue
      lines.push({ itemId: c.componentItemId, quantity: c.quantity * saleQuantity })
    }
    return lines
  }

  if (item.trackInventory !== true) return []
  return [{ itemId: item.id, quantity: saleQuantity }]
}
