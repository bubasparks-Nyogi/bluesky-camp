import { supabaseAdmin } from '@/lib/supabase'

/** プロセス内シンプル LRU。Vercel serverless では完全ではないが、瞬間的な連打は防げる。 */
const memoryStore = new Map<string, number[]>()

export function memoryRateLimit(key: string, windowMs: number, limit: number): boolean {
  const now = Date.now()
  const timestamps = (memoryStore.get(key) ?? []).filter(t => now - t < windowMs)
  if (timestamps.length >= limit) {
    memoryStore.set(key, timestamps)
    return true
  }
  timestamps.push(now)
  memoryStore.set(key, timestamps)
  // 上限を超えたら古いものから捨てる
  if (memoryStore.size > 1000) {
    const firstKey = memoryStore.keys().next().value
    if (firstKey) memoryStore.delete(firstKey)
  }
  return false
}

/**
 * DB ベースのシンプルなレート制限。指定キーで過去 windowMs 以内の失敗回数を数え、
 * limit を超えていれば true（ロック中）を返す。
 */
export async function isRecentlyRateLimited(opts: {
  table: 'receipt_lookup_attempts'
  key: string                // e.g., reservation_id
  windowMs: number
  failLimit: number
}): Promise<boolean> {
  const since = new Date(Date.now() - opts.windowMs).toISOString()
  const { count } = await supabaseAdmin
    .from(opts.table)
    .select('*', { count: 'exact', head: true })
    .eq('reservation_id', opts.key)
    .eq('succeeded', false)
    .gte('attempted_at', since)
  return (count ?? 0) >= opts.failLimit
}

export async function recordLookupAttempt(opts: {
  reservationId: string
  succeeded: boolean
}): Promise<void> {
  await supabaseAdmin
    .from('receipt_lookup_attempts')
    .insert({ reservation_id: opts.reservationId, succeeded: opts.succeeded })
}
