import type { JournalEntryInput } from './types'

export type SaleAccountMap = Record<string, string>

export interface SaleEntryInput {
  saleLineId: string
  itemName: string
  unitPrice: number
  quantity: number
  occurredAt: string
}

const CODE = { ar: '103', sales: '401' } as const

/**
 * 販売明細1件 → 売上仕訳。借方:売掛金(103), 貸方:売上高(401)。
 * amount = Math.round(unitPrice × quantity)。0以下は null。
 */
export function buildSaleEntry(input: SaleEntryInput, accountMap: SaleAccountMap): JournalEntryInput | null {
  const amount = Math.round(input.unitPrice * input.quantity)
  if (!(amount > 0)) return null
  const arId    = accountMap[CODE.ar]
  const salesId = accountMap[CODE.sales]
  if (!arId || !salesId) throw new Error(`必要な勘定科目（${CODE.ar} or ${CODE.sales}）が見つかりません`)
  return {
    entryDate: input.occurredAt,
    description: `売上 ${input.itemName}`,
    lines: [
      { accountId: arId,    side: 'debit',  amount },
      { accountId: salesId, side: 'credit', amount },
    ],
  }
}
