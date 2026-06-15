// lib/pricing.ts
import type { ReservationFormData, PricingItem } from '@/types/reservation'
import { seasonalMultiplierFor, type SeasonalRate } from './pricing/seasonalMultiplier'

export type { SeasonalRate }

export interface PricingRulesOptions {
  isRepeater?: boolean
  multiNightDiscount?: number      // 0..1 (e.g., 0.10 = 10%引き 2泊目以降)
  seasonalRates?: SeasonalRate[]
}

/** チェックインから i 日目（0-indexed）の日付 YYYY-MM-DD を返す */
function nightDate(checkin: string, i: number): string {
  const d = new Date(checkin)
  d.setDate(d.getDate() + i)
  return d.toISOString().slice(0, 10)
}

/** 宿泊料金の単泊計算（i=0 は割引なし、i>=1 は multiNightDiscount 適用） */
function nightlyTotal(
  baseRate: number,
  i: number,
  checkin: string,
  options: PricingRulesOptions,
): number {
  const seasonalMul = seasonalMultiplierFor(nightDate(checkin, i), options.seasonalRates ?? [])
  const discountMul = i === 0 ? 1 : Math.max(0, 1 - (options.multiNightDiscount ?? 0))
  return baseRate * seasonalMul * discountMul
}

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
  options: PricingRulesOptions = {},
): number {
  const get = (key: string) =>
    pricing.find(p => p.itemKey === key && p.active)?.amount ?? 0

  const nights = calcNights(form.checkinDate, form.checkoutDate)
  const types  = form.stayTypes?.length ? form.stayTypes : ['tent']

  let total = 0
  for (const t of types) {
    const baseRate = get(stayTypeKey(t))
    for (let i = 0; i < nights; i++) {
      total += nightlyTotal(baseRate, i, form.checkinDate, options)
    }
  }

  // EHU は使用量料金制のため自動加算しない

  // サウナ・ペットは無料のため加算しない

  if (form.transferCount > 0)
    total += get('transfer') * form.transferCount

  for (const item of form.rentalItems) {
    total += item.price * item.qty
  }

  total = Math.round(total)

  // リピーター割引 10%（Phase 14、端数切り捨て）
  if (options.isRepeater === true) {
    total = Math.floor(total * 0.9)
  }

  return total
}

/** 料金の内訳を返す（確認画面表示用） */
export function calcBreakdown(
  form: ReservationFormData,
  pricing: PricingItem[],
  options: PricingRulesOptions = {},
): Array<{ label: string; amount: number }> {
  const get = (key: string) =>
    pricing.find(p => p.itemKey === key && p.active)

  const rows: Array<{ label: string; amount: number }> = []
  const nights = calcNights(form.checkinDate, form.checkoutDate)
  const types  = form.stayTypes?.length ? form.stayTypes : ['tent']

  // 各宿泊タイプを個別に内訳表示（連泊割引・季節料金を加味した実額）
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
      let amount = 0
      for (let i = 0; i < nights; i++) {
        amount += nightlyTotal(item.amount, i, form.checkinDate, options)
      }
      rows.push({ label, amount: Math.round(amount) })
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
