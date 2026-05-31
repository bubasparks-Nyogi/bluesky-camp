import { supabaseAdmin } from '@/lib/supabase'
import { calcCancellationFee } from '@/lib/cancellation'
import { postReservationEntry, hasPostedEntries } from './serverPosting'
import type { ReservationForPosting, PaymentMethod } from './reservationPosting'

/**
 * 予約キャンセル時の会計仕訳を best-effort で生成する。
 * 失敗してもスロー/拒否しない（呼び出し元のキャンセル処理は止めない）。
 */
export async function postCancellationEntry(reservationId: string): Promise<void> {
  try {
    const posted = await hasPostedEntries(reservationId)
    if (!posted) return  // 計上前キャンセルは何もしない

    const { data: r } = await supabaseAdmin
      .from('reservations')
      .select('id, total_amount, payment_method, checkin_date, checkout_date')
      .eq('id', reservationId).maybeSingle()
    if (!r || (r.payment_method !== 'onsite' && r.payment_method !== 'prepaid')) return

    const fee = calcCancellationFee(r.checkin_date, r.total_amount).fee
    const reservation: ReservationForPosting = {
      id: r.id, totalAmount: r.total_amount, paymentMethod: r.payment_method as PaymentMethod,
      checkinDate: r.checkin_date, checkoutDate: r.checkout_date,
    }
    await postReservationEntry(reservation, 'cancellation', {
      cancelledAt: new Date().toISOString().slice(0, 10),
      fee,
    })
  } catch (e) {
    console.error('postCancellationEntry failed:', e)
  }
}
