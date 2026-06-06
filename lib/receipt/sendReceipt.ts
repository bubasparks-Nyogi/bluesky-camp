import { supabaseAdmin } from '@/lib/supabase'
import { sendReceiptEmail } from '@/lib/email'
import { buildReceiptModel } from './build'
import type { SaleLineRow } from './types'
import type { ReservationRow, PricingItem } from '@/types/reservation'

/**
 * 予約に対する総合領収書を送信し、receipt_logs に記録する。
 */
export async function sendReceiptForReservation(
  reservation: ReservationRow,
  trigger: 'auto' | 'manual',
): Promise<{ totalAmount: number }> {
  const [{ data: pricingRows }, { data: saleLines }] = await Promise.all([
    supabaseAdmin.from('pricing').select('*').eq('active', true),
    supabaseAdmin.from('sale_lines').select('*').eq('reservation_id', reservation.id),
  ])
  const pricing: PricingItem[] = (pricingRows ?? []).map((p: { item_key: string; label: string; amount: number; active: boolean }) => ({
    itemKey: p.item_key, label: p.label, amount: p.amount, active: p.active,
  }))

  let isRepeater = false
  if (reservation.user_id) {
    const { count } = await supabaseAdmin
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', reservation.user_id)
      .neq('id', reservation.id)
    isRepeater = (count ?? 0) >= 1
  }

  const model = buildReceiptModel(reservation, pricing, (saleLines ?? []) as SaleLineRow[], { isRepeater })
  await sendReceiptEmail(model, reservation.guest_email)
  await supabaseAdmin.from('receipt_logs').insert({
    reservation_id: reservation.id,
    type: 'receipt',
    sent_to: reservation.guest_email,
    total_amount: model.grandTotal,
    trigger,
  })
  return { totalAmount: model.grandTotal }
}

/** 既に receipt 送信済みか */
export async function hasReceiptSent(reservationId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('receipt_logs').select('id')
    .eq('reservation_id', reservationId).eq('type', 'receipt').limit(1)
  return (data ?? []).length > 0
}
