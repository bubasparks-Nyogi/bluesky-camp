import { describe, it, expect } from 'vitest'
import { parseOcrResult } from '../ocrReceipt'

const CODES = ['511', '512', '519']

describe('parseOcrResult', () => {
  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({ date: '2026-03-15', amount: 1200, vendor: 'コメリ', accountCode: '519', confidence: 'high' })
    expect(parseOcrResult(raw, CODES)).toEqual({
      date: '2026-03-15', amount: 1200, vendor: 'コメリ', suggestedAccountCode: '519', confidence: 'high', items: [],
    })
  })

  it('normalizes amount with ¥ and commas', () => {
    const raw = JSON.stringify({ date: '2026-03-15', amount: '¥1,200', vendor: 'A', accountCode: '519' })
    expect(parseOcrResult(raw, CODES).amount).toBe(1200)
  })

  it('strips 円 suffix from amount', () => {
    const raw = JSON.stringify({ amount: '3000円' })
    expect(parseOcrResult(raw, CODES).amount).toBe(3000)
  })

  it('blanks an invalid date', () => {
    const raw = JSON.stringify({ date: '不明', amount: 100 })
    expect(parseOcrResult(raw, CODES).date).toBe('')
  })

  it('blanks an account code not in the candidate list', () => {
    const raw = JSON.stringify({ accountCode: '999', amount: 100 })
    expect(parseOcrResult(raw, CODES).suggestedAccountCode).toBe('')
  })

  it('extracts JSON from a ```json fenced response', () => {
    const raw = '```json\n{"date":"2026-01-02","amount":500,"vendor":"B","accountCode":"511"}\n```'
    const d = parseOcrResult(raw, CODES)
    expect(d.date).toBe('2026-01-02')
    expect(d.amount).toBe(500)
    expect(d.suggestedAccountCode).toBe('511')
  })

  it('returns an all-empty draft for unparseable input (no throw)', () => {
    expect(parseOcrResult('totally not json', CODES)).toEqual({
      date: '', amount: 0, vendor: '', suggestedAccountCode: '', confidence: '', items: [],
    })
  })

  it('defaults amount to 0 when missing', () => {
    expect(parseOcrResult(JSON.stringify({ vendor: 'X' }), CODES).amount).toBe(0)
  })
})

import { buildExpenseEntry } from '../ocrReceipt'
import { validateEntry } from '../validateEntry'

describe('buildExpenseEntry', () => {
  const base = {
    date: '2026-03-15', amount: 1200, description: 'コメリ',
    debitAccountId: 'acc-exp', creditAccountId: 'acc-cash',
  }
  it('builds a balanced expense entry that passes validateEntry', () => {
    const e = buildExpenseEntry(base)
    expect(e.entryDate).toBe('2026-03-15')
    expect(e.description).toBe('コメリ')
    expect(e.lines).toEqual([
      { accountId: 'acc-exp',  side: 'debit',  amount: 1200 },
      { accountId: 'acc-cash', side: 'credit', amount: 1200 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('defaults blank description to 経費', () => {
    expect(buildExpenseEntry({ ...base, description: '' }).description).toBe('経費')
  })
  it('throws on non-positive amount', () => {
    expect(() => buildExpenseEntry({ ...base, amount: 0 })).toThrow()
    expect(() => buildExpenseEntry({ ...base, amount: -5 })).toThrow()
  })
  it('throws on non-integer amount', () => {
    expect(() => buildExpenseEntry({ ...base, amount: 12.5 })).toThrow()
  })
  it('throws when debit and credit accounts are the same', () => {
    expect(() => buildExpenseEntry({ ...base, creditAccountId: 'acc-exp' })).toThrow()
  })
})
