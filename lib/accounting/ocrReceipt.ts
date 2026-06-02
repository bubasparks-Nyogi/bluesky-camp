import type { JournalEntryInput } from './types'

export interface OcrDraft {
  date: string
  amount: number
  vendor: string
  suggestedAccountCode: string
  confidence: 'low' | 'medium' | 'high' | ''
}

export interface ExpenseInput {
  date: string
  amount: number
  description: string
  debitAccountId: string
  creditAccountId: string
}

const EMPTY_DRAFT: OcrDraft = {
  date: '', amount: 0, vendor: '', suggestedAccountCode: '', confidence: '',
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1] : raw
  const start = candidate.indexOf('{')
  const end   = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    const obj = JSON.parse(candidate.slice(start, end + 1))
    return (obj && typeof obj === 'object') ? obj as Record<string, unknown> : null
  } catch {
    return null
  }
}

function normalizeAmount(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Number.isInteger(v) ? v : Math.round(v)
  if (typeof v === 'string') {
    const cleaned = v.replace(/[¥,円\s]/g, '')
    const n = Number(cleaned)
    if (Number.isFinite(n)) return Math.round(n)
  }
  return 0
}

export function parseOcrResult(raw: string, validExpenseCodes: string[]): OcrDraft {
  const obj = extractJson(raw)
  if (!obj) return { ...EMPTY_DRAFT }

  const dateRaw = typeof obj.date === 'string' ? obj.date : ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : ''

  const amount = normalizeAmount(obj.amount)

  const vendor = typeof obj.vendor === 'string' ? obj.vendor : ''

  const codeRaw = typeof obj.accountCode === 'string' ? obj.accountCode : ''
  const suggestedAccountCode = validExpenseCodes.includes(codeRaw) ? codeRaw : ''

  const conf = obj.confidence
  const confidence: OcrDraft['confidence'] =
    conf === 'low' || conf === 'medium' || conf === 'high' ? conf : ''

  return { date, amount, vendor, suggestedAccountCode, confidence }
}

export function buildExpenseEntry(input: ExpenseInput): JournalEntryInput {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('金額は正の整数で入力してください')
  }
  if (input.debitAccountId === input.creditAccountId) {
    throw new Error('借方と貸方に同じ科目は指定できません')
  }
  return {
    entryDate: input.date,
    description: input.description || '経費',
    lines: [
      { accountId: input.debitAccountId,  side: 'debit',  amount: input.amount },
      { accountId: input.creditAccountId, side: 'credit', amount: input.amount },
    ],
  }
}
