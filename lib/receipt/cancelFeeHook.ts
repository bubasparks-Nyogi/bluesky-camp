import { supabaseAdmin } from '@/lib/supabase'
import { calcCancellationFee } from '@/lib/cancellation'
import { buildCancellationFeeModel } from './build'
import { sendCancellationFeeEmail } from '@/lib/email'
import type { ReservationRow } from '@/types/reservation'

/**
 * キャンセル料明細書を best-effort で送信。
 */
export async function postCancellationFeeReceipt(reservationId: string): Promise<void> {
  try {
    const { data: existing } = await supabaseAdmin
      .from('receipt_logs').select('id')
      .eq('reservation_id', reservationId).eq('type', 'cancellation_fee').limit(1)
    if ((existing ?? []).length > 0) return

    const { data: r } = await supabaseAdmin
      .from('reservations').select('*').eq('id', reservationId).maybeSingle()
    if (!r) return
    const reservation = r as ReservationRow

    const fee = calcCancellationFee(reservation.checkin_date, reservation.total_amount)
    if (fee.fee <= 0) return

    const today = new Date().toISOString().slice(0, 10)
    const model = buildCancellationFeeModel(reservation, fee, today)
    await sendCancellationFeeEmail(model, reservation.guest_email)
    await supabaseAdmin.from('receipt_logs').insert({
      reservation_id: reservationId,
      type: 'cancellation_fee',
      sent_to: reservation.guest_email,
      total_amount: fee.fee,
      trigger: 'auto',
    })
  } catch (e) {
    console.error('postCancellationFeeReceipt failed:', e)
  }
}
