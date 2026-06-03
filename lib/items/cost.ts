import type { ComponentCostLine } from './types'

export function computeDishCost(lines: ComponentCostLine[]): { cost: number; hasMissingCost: boolean } {
  let total = 0
  let hasMissingCost = false
  for (const l of lines) {
    if (l.costPrice == null) hasMissingCost = true
    total += (l.costPrice ?? 0) * l.quantity
  }
  return { cost: Math.round(total), hasMissingCost }
}
