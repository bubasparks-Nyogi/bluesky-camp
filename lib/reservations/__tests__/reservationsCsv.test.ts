import { describe, it, expect } from 'vitest'
import { reservationsCsv, type ReservationCsvRow } from '../reservationsCsv'

const row = (p: Partial<ReservationCsvRow>): ReservationCsvRow => ({
  shortId: p.shortId ?? 'ABC12345',
  status:  p.status ?? '確定',
  checkinDate:  p.checkinDate  ?? '2026-07-15',
  checkoutDate: p.checkoutDate ?? '2026-07-16',
  stayTypes: p.stayTypes ?? 'テント',
  guestName: p.guestName ?? '山田 太郎',
  guestEmail: p.guestEmail ?? 'taro@example.com',
  guestPhone: p.guestPhone ?? '090-1234-5678',
  totalAmount: p.totalAmount ?? 12000,
  createdAt: p.createdAt ?? '2026-06-13T10:00:00Z',
})

describe('reservationsCsv', () => {
  it('starts with UTF-8 BOM + header', () => {
    const csv = reservationsCsv([])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv).toContain('予約番号')
    expect(csv).toContain('合計金額')
  })

  it('renders 1 row per reservation', () => {
    const csv = reservationsCsv([row({})])
    const lines = csv.slice(1).split('\r\n').filter(l => l.length > 0)
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('"ABC12345"')
    expect(lines[1]).toContain('12000')
  })

  it('preserves order', () => {
    const csv = reservationsCsv([
      row({ shortId: 'AAA' }),
      row({ shortId: 'BBB' }),
    ])
    const lines = csv.slice(1).split('\r\n').filter(l => l.length > 0)
    expect(lines[1]).toContain('AAA')
    expect(lines[2]).toContain('BBB')
  })

  it('escapes commas and quotes in names', () => {
    const csv = reservationsCsv([row({ guestName: '"山田", 太郎' })])
    expect(csv).toContain('"""山田"", 太郎"')
  })
})
