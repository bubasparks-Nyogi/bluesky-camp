export function nonEmpty(v: string | undefined | null): string | undefined {
  if (!v) return undefined
  const t = v.trim()
  if (!t || t === 'all') return undefined
  return t
}

export function buildSearch(qs: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(qs)) {
    if (v !== undefined && v !== '') params.set(k, v)
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}
