import type { JournalEntryInput } from './types'

export interface OcrDraftItem {
  name: string
  qty: number
  unitPrice: number
  subtotal: number
  accountCode: string
}

export interface OcrDraft {
  date: string
  amount: number
  vendor: string
  suggestedAccountCode: string
  confidence: 'low' | 'medium' | 'high' | ''
  items: OcrDraftItem[]
}

export interface ExpenseInput {
  date: string
  amount: number
  description: string
  debitAccountId: string
  creditAccountId: string
}

export interface ExpenseLineInput {
  accountId: string
  amount: number
}

const EMPTY_DRAFT: OcrDraft = {
  date: '', amount: 0, vendor: '', suggestedAccountCode: '', confidence: '', items: [],
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

function normalizeQty(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,\s]/g, ''))
    if (Number.isFinite(n) && n > 0) return n
  }
  return 1
}

function parseItems(raw: unknown, validCodes: string[]): OcrDraftItem[] {
  if (!Array.isArray(raw)) return []
  const out: OcrDraftItem[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) continue
    const qty       = normalizeQty(o.qty)
    const unitPrice = normalizeAmount(o.unitPrice)
    let subtotal    = normalizeAmount(o.subtotal)
    if (subtotal <= 0 && unitPrice > 0) subtotal = Math.round(unitPrice * qty)
    if (subtotal <= 0) continue
    const codeRaw = typeof o.accountCode === 'string' ? o.accountCode : ''
    const accountCode = validCodes.includes(codeRaw) ? codeRaw : ''
    out.push({ name, qty, unitPrice, subtotal, accountCode })
  }
  return out
}

export function parseOcrResult(raw: string, validExpenseCodes: string[]): OcrDraft {
  const obj = extractJson(raw)
  if (!obj) return { ...EMPTY_DRAFT, items: [] }

  const dateRaw = typeof obj.date === 'string' ? obj.date : ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : ''

  const amount = normalizeAmount(obj.amount)

  const vendor = typeof obj.vendor === 'string' ? obj.vendor : ''

  const codeRaw = typeof obj.accountCode === 'string' ? obj.accountCode : ''
  const suggestedAccountCode = validExpenseCodes.includes(codeRaw) ? codeRaw : ''

  const conf = obj.confidence
  const confidence: OcrDraft['confidence'] =
    conf === 'low' || conf === 'medium' || conf === 'high' ? conf : ''

  const items = parseItems(obj.items, validExpenseCodes)

  return { date, amount, vendor, suggestedAccountCode, confidence, items }
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

/**
 * 明細行（費用科目ごと）を集約し、複数借方＋1貸方の仕訳を組み立てる。
 */
export function buildExpenseEntryFromLines(input: {
  date: string
  description: string
  debits: ExpenseLineInput[]     // { accountId, amount } × N
  creditAccountId: string
}): JournalEntryInput {
  if (input.debits.length === 0) throw new Error('明細が1件もありません')
  const debits: { accountId: string; side: 'debit'; amount: number }[] = []
  let total = 0
  for (const d of input.debits) {
    if (!d.accountId) throw new Error('費用科目が未選択の明細があります')
    if (!Number.isInteger(d.amount) || d.amount <= 0)
      throw new Error('金額は正の整数で入力してください')
    debits.push({ accountId: d.accountId, side: 'debit', amount: d.amount })
    total += d.amount
  }
  if (debits.some(d => d.accountId === input.creditAccountId))
    throw new Error('借方と貸方に同じ科目は指定できません')
  return {
    entryDate: input.date,
    description: input.description || '経費',
    lines: [
      ...debits,
      { accountId: input.creditAccountId, side: 'credit', amount: total },
    ],
  }
}
