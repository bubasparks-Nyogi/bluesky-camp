export interface JournalForExport {
  entryDate: string
  description: string
  debitAccount: string
  debitAmount: number
  creditAccount: string
  creditAmount: number
}

const HEADER = [
  '識別フラグ','伝票No','決算','取引日付',
  '借方勘定科目','借方補助科目','借方部門','借方税区分','借方金額','借方税金額','借方摘要',
  '貸方勘定科目','貸方補助科目','貸方部門','貸方税区分','貸方金額','貸方税金額','貸方摘要',
  '摘要','番号','期日','タイプ','生成元','仕訳メモ','付箋1','付箋2',
]

function quote(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

function formatDate(iso: string): string {
  return iso.replace(/-/g, '/')
}

export function yayoiExport(rows: JournalForExport[]): string {
  const lines: string[] = []
  lines.push(HEADER.map(h => quote(h)).join(','))
  for (const r of rows) {
    const cells = [
      quote('2000'), quote(''), quote(''), quote(formatDate(r.entryDate)),
      quote(r.debitAccount), quote(''), quote(''), quote('対象外'), String(r.debitAmount), '0', quote(''),
      quote(r.creditAccount), quote(''), quote(''), quote('対象外'), String(r.creditAmount), '0', quote(''),
      quote(r.description), quote(''), quote(''), quote(''), quote(''), quote(''), quote(''), quote(''),
    ]
    lines.push(cells.join(','))
  }
  return lines.join('\r\n') + '\r\n'
}
