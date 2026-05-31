/** 仕訳明細で使われている account_id の一覧を受け取り、削除可能かを返す */
export function canDeleteAccount(accountId: string, usedAccountIds: string[]): boolean {
  return !usedAccountIds.includes(accountId)
}
