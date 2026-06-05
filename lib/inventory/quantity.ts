export function computeQuantity(deltas: number[]): number {
  return deltas.reduce((sum, d) => sum + d, 0)
}
