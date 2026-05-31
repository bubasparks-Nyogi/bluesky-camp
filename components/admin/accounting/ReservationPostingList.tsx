'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Postable {
  id: string
  guestName: string
  checkinDate: string
  checkoutDate: string
  totalAmount: number
  paymentMethod: string
}

const PM_LABEL: Record<string, string> = { onsite: '現地払い', prepaid: '事前振込' }

export default function ReservationPostingList({ initial }: { initial: Postable[] }) {
  const router = useRouter()
  const [items, setItems]   = useState(initial)
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<Record<string, string>>({})

  const postOne = async (id: string): Promise<boolean> => {
    const res = await fetch('/api/admin/accounting/post-reservation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId: id, phase: 'revenue' }),
    })
    const json = await res.json()
    if (!res.ok) { setMsg(m => ({ ...m, [id]: json.error ?? '失敗' })); return false }
    setMsg(m => ({ ...m, [id]: json.status === 'skipped' ? 'スキップ（計上済み）' : '✓ 計上しました' }))
    return true
  }

  const postSelected = async (id: string) => {
    setBusy(true)
    const ok = await postOne(id)
    if (ok) setItems(list => list.filter(x => x.id !== id))
    setBusy(false)
    router.refresh()
  }

  const postAll = async () => {
    setBusy(true)
    const ids = items.map(x => x.id)
    const remaining: Postable[] = []
    for (const id of ids) {
      const ok = await postOne(id)
      if (!ok) remaining.push(items.find(x => x.id === id)!)
    }
    setItems(remaining)
    setBusy(false)
    router.refresh()
  }

  if (items.length === 0) {
    return <p className="text-warm-400 text-sm">売上計上待ちの予約はありません。</p>
  }

  return (
    <div className="space-y-4">
      <button onClick={postAll} disabled={busy}
        className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40">
        {busy ? '処理中...' : `全部計上（${items.length}件）`}
      </button>
      <div className="space-y-2">
        {items.map(r => (
          <div key={r.id} className="bg-white border border-warm-100 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-warm-700">{r.guestName}</span>
                <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">{PM_LABEL[r.paymentMethod] ?? r.paymentMethod}</span>
              </div>
              <p className="text-warm-500 text-sm mt-1">{r.checkinDate} 〜 {r.checkoutDate} · ¥{r.totalAmount.toLocaleString()}</p>
              {msg[r.id] && <p className="text-xs mt-1 text-warm-600">{msg[r.id]}</p>}
            </div>
            <button onClick={() => postSelected(r.id)} disabled={busy}
              className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 shrink-0">
              計上
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
