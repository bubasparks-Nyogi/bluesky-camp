export function matchReservation(
  reservationId: string,
  email: string,
  reservation: { id: string; guest_email: string },
): boolean {
  if (!reservationId || !email) return false
  if (reservationId !== reservation.id) return false
  return reservation.guest_email.trim().toLowerCase() === email.trim().toLowerCase()
}

export function determineIsReissue(type: string, logs: { type: string }[]): boolean {
  return logs.filter(l => l.type === type).length >= 1
}
