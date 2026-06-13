export interface ReservationCsvRow {
  shortId: string
  status: string
  checkinDate: string
  checkoutDate: string
  stayTypes: string
  guestName: string
  guestEmail: string
  guestPhone: string
  totalAmount: number
  createdAt: string
}

const HEADER = [
  '予約番号','ステータス','チェックイン','チェックアウト',
  '宿泊タイプ','お名前','メール','電話','合計金額','申込日時',
]

function quote(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

export function reservationsCsv(rows: ReservationCsvRow[]): string {
  const lines: string[] = []
  lines.push(HEADER.map(h => quote(h)).join(','))
  for (const r of rows) {
    lines.push([
      quote(r.shortId), quote(r.status),
      quote(r.checkinDate), quote(r.checkoutDate),
      quote(r.stayTypes), quote(r.guestName),
      quote(r.guestEmail), quote(r.guestPhone),
      String(r.totalAmount), quote(r.createdAt),
    ].join(','))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
