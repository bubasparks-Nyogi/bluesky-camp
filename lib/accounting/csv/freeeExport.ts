import type { JournalForExport } from './yayoiExport'

const HEADER = [
  '日付','取引内容',
  '借方勘定科目','借方税区分','借方金額',
  '貸方勘定科目','貸方税区分','貸方金額',
  '管理番号','品目','部門','メモタグ','セグメント1','備考',
]

function quote(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

export function freeeExport(rows: JournalForExport[]): string {
  const lines: string[] = []
  lines.push(HEADER.map(h => quote(h)).join(','))
  for (const r of rows) {
    const cells = [
      quote(r.entryDate), quote(r.description),
      quote(r.debitAccount), quote('対象外'), String(r.debitAmount),
      quote(r.creditAccount), quote('対象外'), String(r.creditAmount),
      quote(''), quote(''), quote(''), quote(''), quote(''), quote(''),
    ]
    lines.push(cells.join(','))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
