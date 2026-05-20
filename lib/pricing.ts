// lib/pricing.ts
import type { ReservationFormData, PricingItem } from '@/types/reservation'

/** チェックイン〜チェックアウト間の泊数（最低1泊） */
export function calcNights(checkin: string, checkout: string): number {
  if (!checkin || !checkout) return 1
  const diff = new Date(checkout).getTime() - new Date(checkin).getTime()
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)))
}

/** 宿泊タイプに対応する pricing item_key を返す */
function stayTypeKey(stayType: string): string {
  return stayType === 'tent' ? 'tent_base' : 'base'
}

/**
 * フォームデータと料金マスタから合計金額を計算する。
 * 基本料金 = 各宿泊タイプの料金 × 泊数 の合計
 * テント: tent_base キー（¥15,000/泊）
 * トレーラー・キャンピングカー: base キー（¥24,000/泊）
 * サウナ・ペット同伴は無料（加算なし）
 * EHU は使用量料金制のため予約時加算なし
 */
export function calcTotal(
  form: ReservationFormData,
  pricing: PricingItem[],
  options: { isRepeater?: boolean } = {},
): number {
  const get = (key: string) =>
    pricing.find(p => p.itemKey === key && p.active)?.amount ?? 0

  const nights = calcNights(form.checkinDate, form.checkoutDate)
  const types  = form.stayTypes?.length ? form.stayTypes : ['tent']

  let total = types.reduce((sum, t) => sum + get(stayTypeKey(t)) * nights, 0)

  // EHU は使用量料金制のため自動加算しない

  // サウナ・ペットは無料のため加算しない

  if (form.transferCount > 0)
    total += get('transfer') * form.transferCount

  for (const item of form.rentalItems) {
    total += item.price * item.qty
  }

  // リピーター割引 10%（Phase 14）
  if (options.isRepeater === true) {
    total = Math.floor(total * 0.9)
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
  const nights = calcNights(form.checkinDate, form.checkoutDate)
  const types  = form.stayTypes?.length ? form.stayTypes : ['tent']

  // 各宿泊タイプを個別に内訳表示
  for (const t of types) {
    const item = get(stayTypeKey(t))
    if (item) {
      const typeLabel = t === 'tent'      ? 'テント設営'
                      : t === 'trailer_a' ? 'トレーラーA'
                      : t === 'trailer_b' ? 'トレーラーB'
                      : 'キャンピングカー'
      const label = nights > 1
        ? `${typeLabel} × ${nights}泊`
        : typeLabel
      rows.push({ label, amount: item.amount * nights })
    }
  }

  // EHU は使用量料金制のため明細に表示しない

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
