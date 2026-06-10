import { describe, it, expect } from 'vitest'
import { expandConsumption } from '../consume'
import type { ItemLite, ComponentLine } from '../consume'

const tracked = (id: string, category: ItemLite['category']): ItemLite => ({ id, category, trackInventory: true })
const untracked = (id: string, category: ItemLite['category']): ItemLite => ({ id, category, trackInventory: false })

describe('expandConsumption', () => {
  it('dish: expands recipe components by sale quantity', () => {
    const meat = tracked('meat', 'ingredient')
    const charcoal = tracked('charcoal', 'supply')
    const dish = tracked('bbq', 'dish')
    const lookup = new Map([['meat', meat], ['charcoal', charcoal], ['bbq', dish]])
    const components: ComponentLine[] = [
      { componentItemId: 'meat',     quantity: 200 },
      { componentItemId: 'charcoal', quantity: 1 },
    ]
    const out = expandConsumption({ saleQuantity: 2, item: dish, components, itemLookup: lookup })
    expect(out).toEqual([
      { itemId: 'meat',     quantity: 400 },
      { itemId: 'charcoal', quantity: 2 },
    ])
  })

  it('non-dish tracked item: consumes itself', () => {
    const beer = tracked('beer', 'drink')
    const lookup = new Map([['beer', beer]])
    expect(expandConsumption({ saleQuantity: 3, item: beer, components: [], itemLookup: lookup }))
      .toEqual([{ itemId: 'beer', quantity: 3 }])
  })

  it('non-dish untracked item: skipped', () => {
    const water = untracked('water', 'drink')
    const lookup = new Map([['water', water]])
    expect(expandConsumption({ saleQuantity: 2, item: water, components: [], itemLookup: lookup }))
      .toEqual([])
  })

  it('dish with one untracked component: skips that component only', () => {
    const meat = tracked('meat', 'ingredient')
    const seasoning = untracked('seasoning', 'ingredient')
    const dish = tracked('curry', 'dish')
    const lookup = new Map([['meat', meat], ['seasoning', seasoning], ['curry', dish]])
    const components: ComponentLine[] = [
      { componentItemId: 'meat',      quantity: 150 },
      { componentItemId: 'seasoning', quantity: 10 },
    ]
    const out = expandConsumption({ saleQuantity: 1, item: dish, components, itemLookup: lookup })
    expect(out).toEqual([{ itemId: 'meat', quantity: 150 }])
  })

  it('zero or negative saleQuantity: empty', () => {
    const beer = tracked('beer', 'drink')
    const lookup = new Map([['beer', beer]])
    expect(expandConsumption({ saleQuantity: 0, item: beer, components: [], itemLookup: lookup })).toEqual([])
    expect(expandConsumption({ saleQuantity: -1, item: beer, components: [], itemLookup: lookup })).toEqual([])
  })

  it('dish with zero-quantity component: skipped', () => {
    const meat = tracked('meat', 'ingredient')
    const dish = tracked('bbq', 'dish')
    const lookup = new Map([['meat', meat], ['bbq', dish]])
    const components: ComponentLine[] = [{ componentItemId: 'meat', quantity: 0 }]
    expect(expandConsumption({ saleQuantity: 2, item: dish, components, itemLookup: lookup })).toEqual([])
  })

  it('component referencing unknown item: skipped', () => {
    const dish = tracked('bbq', 'dish')
    const lookup = new Map([['bbq', dish]])
    const components: ComponentLine[] = [{ componentItemId: 'ghost', quantity: 1 }]
    expect(expandConsumption({ saleQuantity: 1, item: dish, components, itemLookup: lookup })).toEqual([])
  })
})
