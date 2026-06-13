export interface ExtractedLine {
  itemId: string | null
  itemNameRaw: string
  quantity: number
  unitPrice: number | null
  confidence: number
}

interface RawLine {
  itemId?: string | null
  itemNameRaw?: string
  quantity?: number
  unitPrice?: number | null
  confidence?: number
}

export function parseExtractResponse(
  response: { lines?: RawLine[] },
  validItemIds: Set<string>,
): ExtractedLine[] {
  const out: ExtractedLine[] = []
  for (const l of response.lines ?? []) {
    const quantity = Number(l.quantity ?? 0)
    if (!(quantity > 0)) continue
    const rawConf = Number(l.confidence ?? 0)
    const confidence = Math.max(0, Math.min(1, rawConf))
    const itemId = l.itemId && validItemIds.has(l.itemId) ? l.itemId : null
    out.push({
      itemId,
      itemNameRaw: l.itemNameRaw ?? '',
      quantity,
      unitPrice: l.unitPrice ?? null,
      confidence,
    })
  }
  return out
}
