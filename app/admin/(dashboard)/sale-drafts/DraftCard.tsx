'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Draft {
  id: string
  reservationShortId: string
  guestName: string
  checkinDate: string
  checkoutDate: string
  itemId: string | null
  itemName: string | null
  itemNameRaw: string
  unitPrice: number | null
  quantity: number
  occurredAt: string
  confidence: number
  sourceMessageText: string | null
  sourceMessageReceivedAt: string
}

interface Item {
  id: string
  name: string
  sale_price: number | null
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.7 ? 'bg-green-100 text-green-700' : value >= 0.4 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return <span className={`text-xs px-2 py-0.5 rounded ${color}`}>信頼度 {pct}%</span>
}

export default function DraftCard({ draft, items }: { draft: Draft; items: Item[] }) {
  const router = useRouter()
  const [itemId, setItemId]       = useState<string | ''>(draft.itemId ?? '')
  const [quantity, setQuantity]   = useState(String(draft.quantity))
  const [unitPrice, setUnitPrice] = useState(String(draft.unitPrice ?? items.find(i => i.id === draft.itemId)?.sale_price ?? ''))
  const [occurredAt, setOccurredAt] = useState(draft.occurredAt)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)

  const persist = async () => {
    await fetch(`/api/admin/sale-drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: itemId || null,
        quantity: Number(quantity),
        unitPrice: unitPrice ? Number(unitPrice) : null,
        occurredAt,
      }),
    })
  }

  const approve = async () => {
    setBusy(true); setErr(null)
    await persist()
    const res = await fetch(`/api/admin/sale-drafts/${draft.id}/approve`, { method: 'POST' })
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? '承認に失敗しました'); setBusy(false); return }
    router.refresh()
  }

  const reject = async () => {
    const reason = window.prompt('拒否理由（任意）') ?? ''
    setBusy(true); setErr(null)
    const res = await fetch(`/api/admin/sale-drafts/${draft.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? '拒否に失敗しました'); setBusy(false); return }
    router.refresh()
  }

  const itemMissing = !itemId
  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-warm-400 text-xs">🏕 {draft.reservationShortId} {draft.guestName} 様</p>
        <p className="text-warm-500 text-xs">{draft.checkinDate} 〜 {draft.checkoutDate}</p>
      </div>
      <div className="flex items-center justify-between">
        <p className="font-bold text-warm-700">🛒 {draft.itemName ?? draft.itemNameRaw} × {draft.quantity}</p>
        <ConfidenceBadge value={draft.confidence} />
      </div>
      <p className="text-xs text-warm-500 bg-warm-50 rounded p-2">💬「{draft.sourceMessageText}」<br /><span className="text-warm-300">{draft.sourceMessageReceivedAt}</span></p>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="col-span-2">
          <span className="text-warm-400 text-xs">商品</span>
          <select value={itemId} onChange={e => setItemId(e.target.value)}
            className={`w-full border rounded px-2 py-2 ${itemMissing ? 'border-orange-400 bg-orange-50' : 'border-warm-200'}`}>
            <option value="">（未選択）</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
        <label>
          <span className="text-warm-400 text-xs">数量</span>
          <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)}
            className="w-full border border-warm-200 rounded px-2 py-2" />
        </label>
        <label>
          <span className="text-warm-400 text-xs">単価</span>
          <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
            className="w-full border border-warm-200 rounded px-2 py-2" />
        </label>
        <label className="col-span-2">
          <span className="text-warm-400 text-xs">日付</span>
          <input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)}
            className="w-full border border-warm-200 rounded px-2 py-2" />
        </label>
      </div>

      {err && <p className="text-red-500 text-sm">{err}</p>}
      <div className="flex gap-2">
        <button onClick={approve} disabled={busy || itemMissing}
          className="flex-1 bg-warm-500 hover:bg-warm-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg">
          ✅ 承認
        </button>
        <button onClick={reject} disabled={busy}
          className="flex-1 bg-warm-100 hover:bg-warm-200 text-warm-700 font-bold py-2 rounded-lg">
          ❌ 拒否
        </button>
      </div>
    </div>
  )
}
