import { calcBreakdown, calcNights } from '@/lib/pricing'
import type { PricingItem, ReservationRow, ReservationFormData } from '@/types/reservation'
import type { CancellationFeeResult } from '@/lib/cancellation'
import type { ReceiptModel, CancellationFeeModel, SaleLineRow, ReceiptLine, ReceiptSaleLineView } from './types'

function toForm(r: ReservationRow): ReservationFormData {
  return {
    checkinDate:     r.checkin_date,
    checkoutDate:    r.checkout_date,
    stayTypes:       (Array.isArray(r.stay_types) && r.stay_types.length ? r.stay_types : [r.stay_type]) as ReservationFormData['stayTypes'],
    ehu:             r.ehu,
    sauna:           r.sauna,
    pet:             r.pet,
    transferCount:   r.transfer_count,
    transferStation: r.transfer_station ?? '',
    rentalItems:     (r.rental_items ?? []) as ReservationFormData['rentalItems'],
    guestName:       r.guest_name,
    guestEmail:      r.guest_email,
    guestPhone:      r.guest_phone,
    agreedToTerms:   true,
  }
}

export function buildReceiptModel(
  reservation: ReservationRow,
  pricing: PricingItem[],
  saleLines: SaleLineRow[],
  options: { isRepeater?: boolean } = {},
): ReceiptModel {
  const form = toForm(reservation)
  const breakdown = calcBreakdown(form, pricing)
  const reservationLines: ReceiptLine[] = breakdown.map(b => ({ label: b.label, amount: b.amount }))
  const reservationSubtotal = reservationLines.reduce((s, l) => s + l.amount, 0)
  const repeaterDiscount = options.isRepeater === true
    ? reservationSubtotal - Math.floor(reservationSubtotal * 0.9)
    : 0

  const sales: ReceiptSaleLineView[] = saleLines.map(s => ({
    date: s.occurred_at,
    itemName: s.item_name,
    unitPrice: s.unit_price,
    quantity: Number(s.quantity),
    amount: Math.round(s.unit_price * Number(s.quantity)),
  }))
  const salesSubtotal = sales.reduce((s, l) => s + l.amount, 0)

  return {
    guestName: reservation.guest_name,
    reservationShortId: reservation.id.slice(0, 8).toUpperCase(),
    checkinDate: reservation.checkin_date,
    checkoutDate: reservation.checkout_date,
    nights: calcNights(reservation.checkin_date, reservation.checkout_date),
    reservationLines,
    reservationSubtotal,
    repeaterDiscount,
    saleLines: sales,
    salesSubtotal,
    grandTotal: reservationSubtotal - repeaterDiscount + salesSubtotal,
  }
}

export function buildCancellationFeeModel(
  reservation: ReservationRow,
  fee: CancellationFeeResult,
  cancelledAt: string,
): CancellationFeeModel {
  return {
    guestName: reservation.guest_name,
    reservationShortId: reservation.id.slice(0, 8).toUpperCase(),
    checkinDate: reservation.checkin_date,
    checkoutDate: reservation.checkout_date,
    cancelledAt,
    totalAmount: reservation.total_amount,
    feeRate: fee.rate,
    feeAmount: fee.fee,
    feeLabel: fee.label,
  }
}
