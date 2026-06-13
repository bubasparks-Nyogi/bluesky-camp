export function computeReplySuffix(pendingCount: number): string {
  if (pendingCount <= 0) return ''
  return `\n※管理画面に登録案 ${pendingCount} 件あります`
}
