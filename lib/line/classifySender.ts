export function classifySender(lineUserId: string, ownerLineUserId: string | undefined): 'customer' | 'owner' {
  if (!ownerLineUserId) {
    console.warn('[classifySender] LINE_OWNER_USER_ID not set; treating all as customer')
    return 'customer'
  }
  return lineUserId === ownerLineUserId ? 'owner' : 'customer'
}
