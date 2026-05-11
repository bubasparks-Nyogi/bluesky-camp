// lib/pricing.ts
import type { ReservationFormData, PricingItem } from '@/types/reservation'

/**
 * フォームデータと料金マスタから合計金額を計算する。
 * 決済抽象化レイヤー (payment.ts) と確認画面 (StepConfirm) の両方から呼ぶ。
 */
export function calcTotal(
  form: ReservationFormData,
  pricing: PricingItem[],
): number {
  const get = (key: string) =>
    pricing.find(p => p.itemKey === key && p.active)?.amount ?? 0

  let total = get('base')
  if (form.ehu && form.stayType === 'campervan') total += get('ehu')
  if (form.sauna)        total += get('sauna')
  if (form.pet)          total += get('pet')
  if (form.transferCount > 0)
    total += get('transfer') * form.transferCount

  for (const item of form.rentalItems) {
    total += item.price * item.qty
  }
  return total
}

/** 料金の内訳を返す（確認画面表示用） */
export function calcBreakdown(
  form: ReservationFormData,
  pricing: PricingItem[],
): Array<{ label: string; amount: number }> {
  const get = (key: string) =>
    pricing.find(p => p.itemKey === key && p.active)

  const rows: Array<{ label: string; amount: number }> = []
  const base = get('base')
  if (base) rows.push({ label: base.label, amount: base.amount })

  if (form.ehu && form.stayType === 'campervan') {
    const ehu = get('ehu')
    if (ehu) rows.push({ label: ehu.label, amount: ehu.amount })
  }
  if (form.sauna) {
    const s = get('sauna')
    if (s) rows.push({ label: s.label, amount: s.amount })
  }
  if (form.pet) {
    const p = get('pet')
    if (p) rows.push({ label: p.label, amount: p.amount })
  }
  if (form.transferCount > 0) {
    const t = get('transfer')
    if (t) rows.push({
      label: `${t.label} × ${form.transferCount}名`,
      amount: t.amount * form.transferCount,
    })
  }
  for (const item of form.rentalItems) {
    rows.push({
      label: `${item.name} × ${item.qty}`,
      amount: item.price * item.qty,
    })
  }
  return rows
}
