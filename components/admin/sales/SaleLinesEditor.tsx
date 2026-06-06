'use client'
import { useState } from 'react'

interface SaleLine { id: string; item_id: string; item_name: string; unit_price: number; quantity: number; occurred_at: string; note: string | null }
interface ItemOpt { id: string; name: string; sale_price: number | null }
interface ReceiptLog { id: string; type: string; trigger: string; sent_at: string }
interface Props { reservationId: string; initialSaleLines: SaleLine[]; sellableItems: ItemOpt[]; lastReceiptLog: ReceiptLog | null }

export default function SaleLinesEditor({ reservationId, initialSaleLines, sellableItems, lastReceiptLog }: Props) {
  const [lines, setLines] = useState(initialSaleLines)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastSentAt, setLastSentAt] = useState<string | null>(lastReceiptLog?.sent_at ?? null)

  const selected = sellableItems.find(i => i.id === itemId)
  const subtotal = lines.reduce((s, l) => s + Math.round(l.unit_price * Number(l.quantity)), 0)

  const add = async () => {
    setError(null)
    const res = await fetch(`/api/admin/reservations/${reservationId}/sale-lines`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, quantity: Number(qty), occurredAt: date, note: note || undefined }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? '追加に失敗しました'); return }
    setLines(l => [...l, json.saleLine])
    setItemId(''); setQty(''); setNote('')
  }
  const remove = async (lineId: string) => {
    if (!confirm('この行を削除しますか？')) return
    const res = await fetch(`/api/admin/reservations/${reservationId}/sale-lines/${lineId}`, { method: 'DELETE' })
    if (res.ok) setLines(l => l.filter(x => x.id !== lineId))
  }
  const sendReceipt = async () => {
    setError(null); setMsg(null); setBusy(true)
    try {
      const res = await fetch(`/api/admin/reservations/${reservationId}/send-receipt`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '送信に失敗しました'); return }
      setMsg(`送信しました（合計 ¥${(json.totalAmount ?? 0).toLocaleString()}）`)
      setLastSentAt(new Date().toISOString())
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 mt-6">
      <h2 className="font-bold text-warm-700 mb-3">販売明細</h2>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      {msg && <p className="text-green-600 text-sm mb-2">{msg}</p>}

      {lines.length === 0 ? (
        <p className="text-warm-300 text-sm">明細はまだありません</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {lines.map(l => (
              <tr key={l.id} className="border-b border-warm-50">
                <td className="py-1 text-warm-500">{l.occurred_at}</td>
                <td className="text-warm-700">{l.item_name}</td>
                <td className="text-warm-500 text-right">¥{l.unit_price.toLocaleString()} × {l.quantity}</td>
                <td className="text-warm-700 text-right">¥{Math.round(l.unit_price * Number(l.quantity)).toLocaleString()}</td>
                <td className="text-right pl-2"><button onClick={() => remove(l.id)} className="text-red-500 text-xs hover:text-red-700">削除</button></td>
              </tr>
            ))}
            <tr><td colSpan={3} className="py-2 text-right text-warm-500 font-medium">販売小計</td><td className="text-right font-bold text-warm-700">¥{subtotal.toLocaleString()}</td><td></td></tr>
          </tbody>
        </table>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 items-center">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm" />
        <select value={itemId} onChange={e => setItemId(e.target.value)} className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm md:col-span-2">
          <option value="">品目を選択</option>
          {sellableItems.map(i => <option key={i.id} value={i.id}>{i.name}{i.sale_price != null ? ` （¥${i.sale_price.toLocaleString()}）` : ''}</option>)}
        </select>
        <input type="number" step="any" value={qty} onChange={e => setQty(e.target.value)} placeholder="数量" className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm text-right" />
        <button onClick={add} disabled={!itemId || !qty} className="bg-warm-300 hover:bg-warm-400 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-40">追加</button>
      </div>
      <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="メモ (任意)" className="mt-2 w-full border border-warm-200 rounded-lg px-2 py-1.5 text-sm" />
      {selected && selected.sale_price != null && qty && (
        <p className="text-xs text-warm-400 mt-1">合計プレビュー ¥{Math.round(selected.sale_price * Number(qty)).toLocaleString()}</p>
      )}

      <div className="mt-4 border-t border-warm-100 pt-3 flex items-center justify-between flex-wrap gap-2">
        <button onClick={sendReceipt} disabled={busy} className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40">
          {busy ? '送信中...' : (lastSentAt ? '領収書を再送信' : '領収書を送信')}
        </button>
        {lastSentAt && <p className="text-xs text-warm-400">最終送信: {new Date(lastSentAt).toLocaleString('ja-JP')}</p>}
      </div>
    </div>
  )
}
