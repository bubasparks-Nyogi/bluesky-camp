import { describe, it, expect } from 'vitest'
import { validateEntry } from '../validateEntry'
import type { JournalEntryInput } from '../types'

const base = (lines: JournalEntryInput['lines']): JournalEntryInput => ({
  entryDate: '2026-01-15', description: 'test', lines,
})

describe('validateEntry', () => {
  it('returns null for a balanced entry', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit',  amount: 10000 },
      { accountId: 'b', side: 'credit', amount: 10000 },
    ]))).toBeNull()
  })

  it('rejects fewer than 2 lines', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit', amount: 10000 },
    ]))).toBe('明細は2件以上必要です')
  })

  it('rejects non-positive amount', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit',  amount: 0 },
      { accountId: 'b', side: 'credit', amount: 0 },
    ]))).toBe('金額は正の整数で入力してください')
  })

  it('rejects non-integer amount', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit',  amount: 100.5 },
      { accountId: 'b', side: 'credit', amount: 100.5 },
    ]))).toBe('金額は正の整数で入力してください')
  })

  it('rejects invalid side', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'foo' as never, amount: 100 },
      { accountId: 'b', side: 'credit',       amount: 100 },
    ]))).toBe('借方・貸方の指定が不正です')
  })

  it('rejects unbalanced entry with a message showing totals', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit',  amount: 10000 },
      { accountId: 'b', side: 'credit', amount: 9000 },
    ]))).toBe('借方と貸方の合計が一致しません（借方 ¥10,000 / 貸方 ¥9,000）')
  })
})
