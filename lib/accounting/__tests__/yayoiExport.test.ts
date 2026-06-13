import { describe, it, expect } from 'vitest'
import { yayoiExport, type JournalForExport } from '../csv/yayoiExport'

const row = (p: Partial<JournalForExport>): JournalForExport => ({
  entryDate: p.entryDate ?? '2026-06-20',
  description: p.description ?? 'テスト摘要',
  debitAccount: p.debitAccount ?? '売掛金',
  debitAmount: p.debitAmount ?? 6000,
  creditAccount: p.creditAccount ?? '売上高',
  creditAmount: p.creditAmount ?? 6000,
})

describe('yayoiExport', () => {
  it('outputs header on first line', () => {
    const csv = yayoiExport([])
    const head = csv.split('\r\n')[0]
    expect(head).toContain('識別フラグ')
    expect(head).toContain('取引日付')
    expect(head).toContain('借方勘定科目')
  })

  it('renders 1 row per journal', () => {
    const csv = yayoiExport([row({})])
    const lines = csv.split('\r\n').filter(l => l.length > 0)
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('"2000"')
    expect(lines[1]).toContain('"2026/06/20"')
    expect(lines[1]).toContain('"売掛金"')
    expect(lines[1]).toContain('"売上高"')
    expect(lines[1]).toContain('6000')
  })

  it('preserves order of input rows', () => {
    const csv = yayoiExport([
      row({ entryDate: '2026-06-10', description: 'A' }),
      row({ entryDate: '2026-06-20', description: 'B' }),
    ])
    const lines = csv.split('\r\n').filter(l => l.length > 0)
    expect(lines[1]).toContain('"A"')
    expect(lines[2]).toContain('"B"')
  })

  it('escapes commas and quotes in description', () => {
    const csv = yayoiExport([row({ description: '備考,"あり"' })])
    expect(csv).toContain('"備考,""あり"""')
  })
})
