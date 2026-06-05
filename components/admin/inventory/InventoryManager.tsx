'use client'
import { useState } from 'react'

interface Item { id: string; name: string; category: string; unit: string; current_quantity: number }
interface Movement { id: string; type: string; quantity_delta: number; note: string | null; occurred_at: string }

const TYPE_LABEL: Record<string, string> = { in: '入庫', disposal: '廃棄', adjustment: '棚卸調整' }
const CAT_LABEL: Record<string, string> = { ingredient: '食材', dish: '料理', goods: '物販', drink: 'ドリンク', supply: '消耗品' }

function Row({ item }: { item: Item }) {
  const [qty, setQty] = useState(item.current_quantity)
  const [type, setType] = useState<'in' | 'disposal' | 'adjustment'>('in')
  const [value, setValue] = useState('')
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<Movement[] | null>(null)
  const [busy, setBusy] = useState(false)

  const record = async () => {
    setError(null); setBusy(true)
    try {
      const res = await fetch('/api/admin/inventory/movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, type, value: Number(value), occurredAt, note: note || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '記録に失敗しました'); return }
      setQty(json.currentQuantity)
      setValue(''); setNote('')
      if (open) loadHistory()
    } finally { setBusy(false) }
  }

  const loadHistory = async () => {
    const res = await fetch(`/api/admin/inventory/movements?itemId=${item.id}`)
    const json = await res.json()
    if (res.ok) setHistory(json.movements)
  }
  const toggle = () => { const n = !open; setOpen(n); if (n && history === null) loadHistory() }

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="font-medium text-warm-700">{item.name}</span>
          <span className="ml-2 text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">{CAT_LABEL[item.category] ?? item.category}</span>
        </div>
        <div className={`font-bold ${qty <= 0 ? 'text-red-500' : 'text-warm-700'}`}>現在庫 {qty} {item.unit}</div>
      </div>

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 items-center">
        <select value={type} onChange={e => setType(e.target.value as 'in' | 'disposal' | 'adjustment')}
          className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm">
          <option value="in">入庫</option>
          <option value="disposal">廃棄</option>
          <option value="adjustment">棚卸調整(実数)</option>
        </select>
        <input type="number" step="any" value={value} onChange={e => setValue(e.target.value)}
          placeholder={type === 'adjustment' ? '実数' : '数量'}
          className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm text-right" />
        <input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)}
          className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm" />
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="メモ"
          className="border border-warm-200 rounded-lg px-2 py-1.5 text-sm" />
        <button onClick={record} disabled={busy || !value}
          className="bg-warm-500 hover:bg-warm-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-40">記録</button>
      </div>

      <button onClick={toggle} className="mt-2 text-warm-500 text-xs hover:text-warm-700">{open ? '▼ 履歴を隠す' : '▶ 動き履歴'}</button>
      {open && history && (
        <table className="w-full text-xs mt-2">
          <tbody>
            {history.map(m => (
              <tr key={m.id} className="border-b border-warm-50">
                <td className="py-1 text-warm-500">{m.occurred_at}</td>
                <td className="text-warm-600">{TYPE_LABEL[m.type] ?? m.type}</td>
                <td className={`text-right ${m.quantity_delta < 0 ? 'text-red-500' : 'text-green-600'}`}>{m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}</td>
                <td className="text-warm-400 pl-2">{m.note ?? ''}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={4} className="text-warm-300 py-2">履歴なし</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function InventoryManager({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-warm-400 text-sm">在庫管理対象の品目がありません。「商品・メニュー管理」で品目の「在庫管理」をオンにしてください。</p>
  }
  return <div className="space-y-2">{items.map(it => <Row key={it.id} item={it} />)}</div>
}
