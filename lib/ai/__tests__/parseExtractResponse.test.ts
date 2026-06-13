import { describe, it, expect } from 'vitest'
import { parseExtractResponse } from '../parseExtractResponse'

const validItemIds = new Set(['itm-001', 'itm-002'])

describe('parseExtractResponse', () => {
  it('parses normal response with all fields', () => {
    const r = parseExtractResponse(
      { lines: [{ itemId: 'itm-001', itemNameRaw: 'ビール', quantity: 2, unitPrice: 500, confidence: 0.95 }] },
      validItemIds,
    )
    expect(r).toEqual([
      { itemId: 'itm-001', itemNameRaw: 'ビール', quantity: 2, unitPrice: 500, confidence: 0.95 },
    ])
  })

  it('nulls out itemId not in valid set', () => {
    const r = parseExtractResponse(
      { lines: [{ itemId: 'itm-999', itemNameRaw: 'X', quantity: 1, unitPrice: null, confidence: 0.5 }] },
      validItemIds,
    )
    expect(r[0].itemId).toBeNull()
  })

  it('skips lines with quantity <= 0', () => {
    const r = parseExtractResponse(
      { lines: [
        { itemId: 'itm-001', itemNameRaw: 'A', quantity: 0,  unitPrice: 500, confidence: 0.9 },
        { itemId: 'itm-002', itemNameRaw: 'B', quantity: -1, unitPrice: 300, confidence: 0.9 },
        { itemId: 'itm-001', itemNameRaw: 'C', quantity: 1,  unitPrice: 500, confidence: 0.9 },
      ]},
      validItemIds,
    )
    expect(r).toHaveLength(1)
    expect(r[0].itemNameRaw).toBe('C')
  })

  it('returns empty array for empty input', () => {
    expect(parseExtractResponse({ lines: [] }, validItemIds)).toEqual([])
  })

  it('clamps confidence outside 0..1', () => {
    const r = parseExtractResponse(
      { lines: [
        { itemId: 'itm-001', itemNameRaw: 'A', quantity: 1, unitPrice: null, confidence: 1.5 },
        { itemId: 'itm-002', itemNameRaw: 'B', quantity: 1, unitPrice: null, confidence: -0.2 },
      ]},
      validItemIds,
    )
    expect(r[0].confidence).toBe(1)
    expect(r[1].confidence).toBe(0)
  })
})
