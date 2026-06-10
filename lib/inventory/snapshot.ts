import type { JournalEntryInput } from '@/lib/accounting/types'

export interface SnapshotInputItem {
  itemId: string
  quantity: number
  costPrice: number | null
}

export interface SnapshotLineResult {
  itemId: string
  quantity: number
  costPrice: number | null
  value: number
}

export interface SnapshotResult {
  lines: SnapshotLineResult[]
  totalValue: number
  missingCostCount: number
}

export function buildSnapshotLines(items: SnapshotInputItem[]): SnapshotResult {
  const lines: SnapshotLineResult[] = []
  let totalValue = 0
  let missingCostCount = 0
  for (const it of items) {
    if (!(it.quantity > 0)) continue
    let value = 0
    if (it.costPrice == null) {
      missingCostCount++
    } else {
      value = Math.round(it.quantity * it.costPrice)
    }
    lines.push({ itemId: it.itemId, quantity: it.quantity, costPrice: it.costPrice, value })
    totalValue += value
  }
  return { lines, totalValue, missingCostCount }
}

const CODE = { merchandise: '105', purchase: '501' } as const

export function buildSnapshotJournal(
  totalValue: number,
  fiscalYear: number,
  type: 'closing' | 'opening',
  accountMap: Record<string, string>,
): JournalEntryInput | null {
  if (!(totalValue > 0)) return null
  const merId = accountMap[CODE.merchandise]
  const purId = accountMap[CODE.purchase]
  if (!merId || !purId) throw new Error(`必要な勘定科目（${CODE.merchandise} or ${CODE.purchase}）が見つかりません`)

  if (type === 'closing') {
    return {
      entryDate: `${fiscalYear}-12-31`,
      description: `期末商品棚卸高 ${fiscalYear}年度`,
      lines: [
        { accountId: merId, side: 'debit',  amount: totalValue },
        { accountId: purId, side: 'credit', amount: totalValue },
      ],
    }
  }
  return {
    entryDate: `${fiscalYear}-01-01`,
    description: `期首商品棚卸高 ${fiscalYear}年度`,
    lines: [
      { accountId: purId, side: 'debit',  amount: totalValue },
      { accountId: merId, side: 'credit', amount: totalValue },
    ],
  }
}
