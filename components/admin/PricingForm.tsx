'use client'
import { useState } from 'react'

interface PricingRow {
  id:       string
  item_key: string
  label:    string
  amount:   number
  active:   boolean
}

interface Props { items: PricingRow[] }

export default function PricingForm({ items: initial }: Props) {
  const [items,   setItems]   = useState<PricingRow[]>(initial)
  const [saving,  setSaving]  = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSave = async (item: PricingRow) => {
    setSaving(item.id)
    const res = await fetch('/api/admin/pricing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, amount: item.amount, active: item.active }),
    })
    setSaving(null)
    setMessage(res.ok ? '保存しました' : '保存に失敗しました')
    setTimeout(() => setMessage(null), 3000)
  }

  const update = (id: string, key: keyof PricingRow, value: number | boolean) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))

  return (
    <div className="space-y-3">
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">
          {message}
        </div>
      )}
      {items.map(item => (
        <div key={item.id}
             className={`flex flex-wrap items-center gap-4 p-4 bg-white border rounded-xl
               ${item.active ? 'border-warm-200' : 'border-gray-200 opacity-60'}`}>
          <div className="flex-1 min-w-[120px]">
            <p className="font-medium text-warm-700 text-sm">{item.label}</p>
            <p className="text-xs text-warm-400">{item.item_key}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-warm-400 text-sm">¥</span>
            <input
              type="number"
              value={item.amount}
              onChange={e => update(item.id, 'amount', Number(e.target.value))}
              className="w-24 border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700
                         focus:outline-none focus:border-warm-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-warm-500 cursor-pointer">
            <input
              type="checkbox"
              checked={item.active}
              onChange={e => update(item.id, 'active', e.target.checked)}
              className="w-4 h-4 accent-warm-300"
            />
            有効
          </label>
          <button
            onClick={() => handleSave(item)}
            disabled={saving === item.id}
            className="bg-warm-300 hover:bg-warm-400 disabled:opacity-60 text-white text-sm
                       font-bold px-4 py-2 rounded-lg transition-colors"
          >
            {saving === item.id ? '保存中...' : '保存'}
          </button>
        </div>
      ))}
    </div>
  )
}
