export interface ActiveReservationRow {
  id: string
  checkin_date: string
  checkout_date: string
  created_at: string
}

export function resolveActiveReservation(
  today: string,
  rows: ActiveReservationRow[],
): ActiveReservationRow | null {
  const matches = rows.filter(r => r.checkin_date <= today && today <= r.checkout_date)
  if (matches.length === 0) return null
  matches.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return matches[0]
}
