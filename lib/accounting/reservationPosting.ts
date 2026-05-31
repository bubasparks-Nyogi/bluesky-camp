import type { JournalEntryInput, JournalLineInput } from './types'

export type PaymentMethod = 'onsite' | 'prepaid'
export type PostingPhase  = 'prepayment' | 'revenue' | 'cancellation'

export interface ReservationForPosting {
  id: string
  totalAmount: number
  paymentMethod: PaymentMethod
  checkinDate: string
  checkoutDate: string
}

/** 科目コード → account_id の解決マップ */
export type AccountCodeMap = Record<string, string>

const CODE = {
  cash: '101', bank: '102', receivable: '103',
  advance: '203', sales: '401', misc: '402',
} as const

interface BuildOpts {
  paidAt?: string
  cancelledAt?: string
  fee?: number
}

export function buildReservationEntry(
  r: ReservationForPosting,
  phase: PostingPhase,
  accountMap: AccountCodeMap,
  opts: BuildOpts = {},
): JournalEntryInput | null {
  const acc = (code: string) => {
    const id = accountMap[code]
    if (!id) throw new Error(`勘定科目コード${code}が見つかりません`)
    return id
  }
  const line = (code: string, side: 'debit' | 'credit', amount: number): JournalLineInput =>
    ({ accountId: acc(code), side, amount })

  if (phase === 'prepayment') {
    if (r.paymentMethod !== 'prepaid') return null
    return {
      entryDate: opts.paidAt ?? r.checkinDate,
      description: `前受金 予約${r.id}`,
      lines: [
        line(CODE.bank, 'debit', r.totalAmount),
        line(CODE.advance, 'credit', r.totalAmount),
      ],
    }
  }

  if (phase === 'revenue') {
    const debitCode = r.paymentMethod === 'prepaid' ? CODE.advance : CODE.cash
    return {
      entryDate: r.checkoutDate,
      description: `売上 予約${r.id}`,
      lines: [
        line(debitCode, 'debit', r.totalAmount),
        line(CODE.sales, 'credit', r.totalAmount),
      ],
    }
  }

  // cancellation
  const rawFee = opts.fee ?? 0
  const fee = Math.max(0, Math.min(rawFee, r.totalAmount))
  const entryDate = opts.cancelledAt ?? r.checkoutDate
  const description = `キャンセル 予約${r.id}`

  if (r.paymentMethod === 'prepaid') {
    const refund = r.totalAmount - fee
    const lines: JournalLineInput[] = [line(CODE.advance, 'debit', r.totalAmount)]
    if (fee > 0)    lines.push(line(CODE.misc, 'credit', fee))
    if (refund > 0) lines.push(line(CODE.bank, 'credit', refund))
    return { entryDate, description, lines }
  }

  // onsite
  if (fee <= 0) return null
  return {
    entryDate, description,
    lines: [
      line(CODE.receivable, 'debit', fee),
      line(CODE.misc, 'credit', fee),
    ],
  }
}

/** 売上計上待ちの抽出（DB行のスネークケースを受け取る） */
interface ReservationRow {
  id: string
  total_amount: number
  payment_method: string | null
  checkin_date: string
  checkout_date: string
  status: string
}

export function filterPostableReservations(
  rows: ReservationRow[],
  today: string,
  postedRevenueIds: Set<string>,
): ReservationForPosting[] {
  return rows
    .filter(r =>
      r.status === 'confirmed' &&
      r.checkout_date <= today &&
      (r.payment_method === 'onsite' || r.payment_method === 'prepaid') &&
      !postedRevenueIds.has(r.id),
    )
    .map(r => ({
      id: r.id,
      totalAmount: r.total_amount,
      paymentMethod: r.payment_method as PaymentMethod,
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
    }))
}
