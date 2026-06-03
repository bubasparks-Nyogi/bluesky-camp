import type { ComponentEdge } from './types'

/**
 * parent -> component の有向辺を追加したとき循環するかを判定する。
 * component を起点に既存の辺を辿り、parent に到達できれば循環（true）。
 */
export function detectRecipeCycle(parentId: string, componentId: string, edges: ComponentEdge[]): boolean {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const arr = adj.get(e.parentId) ?? []
    arr.push(e.componentId)
    adj.set(e.parentId, arr)
  }
  const visited = new Set<string>()
  const stack = [componentId]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node === parentId) return true
    if (visited.has(node)) continue
    visited.add(node)
    for (const next of adj.get(node) ?? []) stack.push(next)
  }
  return false
}
