import type { JournalEntryInput } from './types'

export function validateEntry(entry: JournalEntryInput): string | null {
  const { lines } = entry
  if (!lines || lines.length < 2) {
    return '明細は2件以上必要です'
  }
  for (const line of lines) {
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      return '金額は正の整数で入力してください'
    }
    if (line.side !== 'debit' && line.side !== 'credit') {
      return '借方・貸方の指定が不正です'
    }
  }
  const debit  = lines.filter(l => l.side === 'debit').reduce((s, l) => s + l.amount, 0)
  const credit = lines.filter(l => l.side === 'credit').reduce((s, l) => s + l.amount, 0)
  if (debit !== credit) {
    return `借方と貸方の合計が一致しません（借方 ¥${debit.toLocaleString()} / 貸方 ¥${credit.toLocaleString()}）`
  }
  return null
}
