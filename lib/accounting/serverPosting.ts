import { supabaseAdmin } from '@/lib/supabase'
import { validateEntry } from './validateEntry'
import {
  buildReservationEntry,
  REQUIRED_ACCOUNT_CODES,
  type ReservationForPosting,
  type PostingPhase,
  type AccountCodeMap,
} from './reservationPosting'

export interface PostResult {
  status: 'posted' | 'skipped' | 'error'
  entryId?: string
  error?: string
}

/** accounts テーブルから コード→ID マップを構築 */
async function buildAccountMap(): Promise<AccountCodeMap> {
  const { data, error } = await supabaseAdmin.from('accounts').select('id, code')
  if (error) throw new Error(`勘定科目の取得に失敗しました: ${error.message}`)
  const map: AccountCodeMap = {}
  for (const a of data ?? []) map[a.code] = a.id
  return map
}

/**
 * 予約に対する仕訳を冪等に生成・保存する。
 * 既に同じ source_id があれば skipped。生成結果が null（仕訳不要）も skipped。
 */
export async function postReservationEntry(
  reservation: ReservationForPosting,
  phase: PostingPhase,
  opts: { paidAt?: string; cancelledAt?: string; fee?: number } = {},
): Promise<PostResult> {
  const sourceId = `${reservation.id}:${phase}`

  const { data: existing } = await supabaseAdmin
    .from('journal_entries')
    .select('id')
    .eq('source', 'reservation')
    .eq('source_id', sourceId)
    .maybeSingle()
  if (existing) return { status: 'skipped' }

  let accountMap: AccountCodeMap
  try {
    accountMap = await buildAccountMap()
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : '勘定科目の取得に失敗しました' }
  }

  const required = REQUIRED_ACCOUNT_CODES
  for (const code of required) {
    if (!accountMap[code]) {
      return { status: 'error', error: `必要な勘定科目（コード${code}）が見つかりません` }
    }
  }

  const entry = buildReservationEntry(reservation, phase, accountMap, opts)
  if (!entry) return { status: 'skipped' }

  const err = validateEntry(entry)
  if (err) return { status: 'error', error: err }

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      entry_date: entry.entryDate,
      description: entry.description,
      source: 'reservation',
      source_id: sourceId,
    })
    .select().single()
  if (headerErr || !header) return { status: 'error', error: headerErr?.message ?? '仕訳の作成に失敗しました' }

  const lines = entry.lines.map((l, i) => ({
    journal_entry_id: header.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
    return { status: 'error', error: linesErr.message }
  }
  return { status: 'posted', entryId: header.id }
}

/** その予約に前受金 or 売上の仕訳が既に存在するか（キャンセル要否判定用） */
export async function hasPostedEntries(reservationId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('journal_entries')
    .select('source_id')
    .eq('source', 'reservation')
    .in('source_id', [`${reservationId}:prepayment`, `${reservationId}:revenue`])
    .limit(1)
  return (data ?? []).length > 0
}
