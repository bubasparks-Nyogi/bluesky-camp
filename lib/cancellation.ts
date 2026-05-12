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
  if (totalAmount < 0) throw new RangeError('totalAmount must be >= 0')

  const baseDate = today ? new Date(today) : new Date()
  const checkin  = new Date(checkinDate)
  baseDate.setHours(0, 0, 0, 0)
  checkin.setHours(0, 0, 0, 0)
  const diffDays = Math.round((checkin.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24))
  // diffDays < 0 の場合（チェックイン日を過ぎている）も 100% 扱い

  if (diffDays >= 7) {
    return { fee: 0, rate: 0, label: '無料' }
  }
  if (diffDays >= 3) {
    return { fee: Math.round(totalAmount * 0.5), rate: 50, label: '合計金額の50%' }
  }
  return { fee: totalAmount, rate: 100, label: '合計金額の100%' }
}
