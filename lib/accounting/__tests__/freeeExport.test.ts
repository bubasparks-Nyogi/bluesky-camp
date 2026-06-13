import { describe, it, expect } from 'vitest'
import { freeeExport } from '../csv/freeeExport'
import type { JournalForExport } from '../csv/yayoiExport'

const row = (p: Partial<JournalForExport>): JournalForExport => ({
  entryDate: p.entryDate ?? '2026-06-20',
  description: p.description ?? 'テスト摘要',
  debitAccount: p.debitAccount ?? '売掛金',
  debitAmount: p.debitAmount ?? 6000,
  creditAccount: p.creditAccount ?? '売上高',
  creditAmount: p.creditAmount ?? 6000,
})

describe('freeeExport', () => {
  it('starts with UTF-8 BOM and header', () => {
    const csv = freeeExport([])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    const head = csv.slice(1).split('\r\n')[0]
    expect(head).toContain('日付')
    expect(head).toContain('借方勘定科目')
  })

  it('renders YYYY-MM-DD date format', () => {
    const csv = freeeExport([row({ entryDate: '2026-06-20' })])
    expect(csv).toContain('"2026-06-20"')
  })

  it('preserves order of input rows', () => {
    const csv = freeeExport([
      row({ entryDate: '2026-06-10', description: 'A' }),
      row({ entryDate: '2026-06-20', description: 'B' }),
    ])
    const lines = csv.slice(1).split('\r\n').filter(l => l.length > 0)
    expect(lines[1]).toContain('"A"')
    expect(lines[2]).toContain('"B"')
  })

  it('escapes commas and quotes in description', () => {
    const csv = freeeExport([row({ description: '備考,"あり"' })])
    expect(csv).toContain('"備考,""あり"""')
  })
})
