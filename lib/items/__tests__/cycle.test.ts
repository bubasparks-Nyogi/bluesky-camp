import { describe, it, expect } from 'vitest'
import { detectRecipeCycle } from '../cycle'
import type { ComponentEdge } from '../types'

describe('detectRecipeCycle', () => {
  it('returns false when adding a non-cyclic edge', () => {
    const edges: ComponentEdge[] = [{ parentId: 'A', componentId: 'B' }]
    expect(detectRecipeCycle('A', 'C', edges)).toBe(false)
  })
  it('detects a direct back-edge (B already contains A)', () => {
    const edges: ComponentEdge[] = [{ parentId: 'B', componentId: 'A' }]
    expect(detectRecipeCycle('A', 'B', edges)).toBe(true)
  })
  it('detects a multi-level cycle (C->A exists, adding A->? leads back)', () => {
    const edges: ComponentEdge[] = [
      { parentId: 'A', componentId: 'B' },
      { parentId: 'B', componentId: 'C' },
    ]
    expect(detectRecipeCycle('C', 'A', edges)).toBe(true)
  })
  it('returns false for unrelated edges', () => {
    const edges: ComponentEdge[] = [
      { parentId: 'A', componentId: 'B' },
      { parentId: 'C', componentId: 'D' },
    ]
    expect(detectRecipeCycle('A', 'D', edges)).toBe(false)
  })
})
