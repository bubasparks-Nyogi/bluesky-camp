export interface ReceiptLine {
  label: string
  amount: number
}

export interface ReceiptSaleLineView {
  date: string
  itemName: string
  unitPrice: number
  quantity: number
  amount: number
}

export interface ReceiptModel {
  guestName: string
  reservationId: string
  reservationShortId: string
  checkinDate: string
  checkoutDate: string
  nights: number
  reservationLines: ReceiptLine[]
  reservationSubtotal: number
  repeaterDiscount: number
  saleLines: ReceiptSaleLineView[]
  salesSubtotal: number
  grandTotal: number
}

export interface CancellationFeeModel {
  guestName: string
  reservationId: string
  reservationShortId: string
  checkinDate: string
  checkoutDate: string
  cancelledAt: string
  totalAmount: number
  feeRate: number
  feeAmount: number
  feeLabel: string
}

export interface SaleLineRow {
  id: string
  reservation_id: string
  item_id: string
  item_name: string
  unit_price: number
  quantity: number
  occurred_at: string
  note: string | null
  created_at?: string
}
