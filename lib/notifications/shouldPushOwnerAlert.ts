export function shouldPushOwnerAlert(pendingCount: number, alreadyAlertedToday: boolean): boolean {
  if (alreadyAlertedToday) return false
  return pendingCount >= 3
}
