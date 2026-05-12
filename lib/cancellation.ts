// lib/cancellation.ts

export interface CancellationFeeResult {
  fee:   number
  rate:  number
  label: string
}

export function calcCancellationFee(
  checkinDate: string,
  totalAmount: number,
  today?: string,
): CancellationFeeResult {
  const baseDate = today ? new Date(today) : new Date()
  const checkin  = new Date(checkinDate)
  baseDate.setHours(0, 0, 0, 0)
  checkin.setHours(0, 0, 0, 0)
  const diffDays = Math.round((checkin.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays >= 7) {
    return { fee: 0, rate: 0, label: '無料' }
  }
  if (diffDays >= 3) {
    return { fee: Math.round(totalAmount * 0.5), rate: 50, label: '合計金額の50%' }
  }
  return { fee: totalAmount, rate: 100, label: '合計金額の100%' }
}
