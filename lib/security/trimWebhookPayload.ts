/**
 * Webhook の raw_event 保存を軽量化するヘルパー。
 * 監査・デバッグに必要な最低限のフィールドだけを抜き出し、
 * 大きな payload や PII を含み得る部分を捨てる。
 */

export function trimLineEvent(ev: unknown): Record<string, unknown> {
  if (!ev || typeof ev !== 'object') return {}
  const e = ev as Record<string, unknown>
  const out: Record<string, unknown> = {
    type: e.type,
    timestamp: e.timestamp,
  }
  if (e.message && typeof e.message === 'object') {
    const m = e.message as Record<string, unknown>
    out.message = { id: m.id, type: m.type }
    // text は line_messages.text に別途保存するので raw からは省略
  }
  if (e.source && typeof e.source === 'object') {
    const s = e.source as Record<string, unknown>
    out.source = { type: s.type, userId: s.userId }
  }
  if (e.postback && typeof e.postback === 'object') {
    out.postback = { data: (e.postback as Record<string, unknown>).data }
  }
  return out
}

export function trimKomojuEvent(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  const p = payload as Record<string, unknown>
  const out: Record<string, unknown> = { type: p.type }
  if (p.data && typeof p.data === 'object') {
    const d = p.data as Record<string, unknown>
    out.data = {
      id: d.id,
      amount: d.amount,
      status: d.status,
      currency: d.currency,
      payment_method: d.payment_method && typeof d.payment_method === 'object'
        ? { type: (d.payment_method as Record<string, unknown>).type }
        : null,
      metadata: d.metadata,
      created_at: d.created_at,
      refunded_amount: d.refunded_amount,
    }
  }
  return out
}
