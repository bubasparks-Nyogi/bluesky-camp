/**
 * 日本の消費税ヘルパー。全金額は原則「税込」で保持し、税率から税額を逆算する方式。
 * 免税事業者期間（Phase B）は仕訳自体は税込経理のままだが、
 * 明細に tax_rate / tax_amount を記録して将来（Phase C: 課税事業者移行時）の還付計算に備える。
 */

export const VALID_TAX_RATES = [0, 0.08, 0.10] as const
export type TaxRate = (typeof VALID_TAX_RATES)[number]

/** 税込金額と税率から、含まれている消費税額を計算する。 */
export function taxFromIncluded(subtotalIncluded: number, taxRate: number): number {
  if (!(taxRate > 0) || !(subtotalIncluded > 0)) return 0
  return Math.round((subtotalIncluded * taxRate) / (1 + taxRate))
}

/** 税込金額から税抜金額を計算する。 */
export function exclFromIncluded(subtotalIncluded: number, taxRate: number): number {
  return subtotalIncluded - taxFromIncluded(subtotalIncluded, taxRate)
}

/** 未知の値が有効な税率か検証（そうでなければデフォルト 0.10）。 */
export function normalizeTaxRate(v: unknown): TaxRate {
  const n = typeof v === 'number' ? v : Number(v)
  if (n === 0 || n === 0.08 || n === 0.10) return n
  return 0.10
}
