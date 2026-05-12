// lib/pricing.ts
import type { ReservationFormData, PricingItem } from '@/types/reservation'

/** チェックイン〜チェックアウト間の泊数（最低1泊） */
export function calcNights(checkin: string, checkout: string): number {
  if (!checkin || !checkout) return 1
  const diff = new Date(checkout).getTime() - new Date(checkin).getTime()
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)))
}

/**
 * フォームデータと料金マスタから合計金額を計算する。
 * 基本料金 = base × 泊数 × 宿泊タイプ数
 * サウナ・ペット同伴は無料（加算なし）
 */
export function calcTotal(
  form: ReservationFormData,
  pricing: PricingItem[],
): number {
  const get = (key: string) =>
    pricing.find(p => p.itemKey === key && p.active)?.amount ?? 0

  const nights    = calcNights(form.checkinDate, form.checkoutDate)
  const typeCount = form.stayTypes?.length ?? 1

  let total = get('base') * nights * typeCount

  // EHU はキャンピングカー選択時のみ
  if (form.ehu && form.stayTypes?.includes('campervan'))
    total += get('ehu')

  // サウナ・ペットは無料のため加算しない

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
  const base     = get('base')
  const nights   = calcNights(form.checkinDate, form.checkoutDate)
  const typeCount = form.stayTypes?.length ?? 1

  if (base) {
    const label = typeCount > 1 || nights > 1
      ? `${base.label} × ${nights}泊 × ${typeCount}タイプ`
      : base.label
    rows.push({ label, amount: base.amount * nights * typeCount })
  }

  if (form.ehu && form.stayTypes?.includes('campervan')) {
    const ehu = get('ehu')
    if (ehu) rows.push({ label: ehu.label, amount: ehu.amount })
  }

  // サウナ・ペットは無料のため明細に表示しない

  if (form.transferCount > 0) {
    const t = get('transfer')
    if (t) rows.push({
      label:  `${t.label} × ${form.transferCount}名`,
      amount: t.amount * form.transferCount,
    })
  }

  for (const item of form.rentalItems) {
    rows.push({
      label:  `${item.name} × ${item.qty}`,
      amount: item.price * item.qty,
    })
  }
  return rows
}
