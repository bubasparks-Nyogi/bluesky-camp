'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  entryId: string
  description: string
}

export default function DeleteEntryButton({ entryId, description }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (!confirm(
      `この仕訳を削除しますか？\n\n「${description}」\n\n` +
      `※ 商品マスタに紐付いた仕入明細があれば、在庫も自動で巻き戻します。\n` +
      `※ Drive レシート取込は、削除後にもう一度取り込めるようになります。\n\n` +
      `この操作は元に戻せません。`
    )) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/accounting/entries/${entryId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert(json.error ?? '削除に失敗しました'); return }
      if (json.stockReverted > 0) {
        alert(`削除しました（在庫 ${json.stockReverted} 件を巻き戻しました）`)
      }
      router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <button onClick={remove} disabled={busy}
      className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded px-2 py-0.5 disabled:opacity-40">
      {busy ? '削除中...' : '削除'}
    </button>
  )
}
