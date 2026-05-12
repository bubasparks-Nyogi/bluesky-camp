'use client'
import { useState } from 'react'

interface RentalRow { id: string; name: string; price_per_day: number; available: boolean }

interface Props { items: RentalRow[] }

export default function RentalItemsForm({ items: initial }: Props) {
  const [items,    setItems]    = useState<RentalRow[]>(initial)
  const [newName,  setNewName]  = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [saving,   setSaving]   = useState<string | null>(null)
  const [adding,   setAdding]   = useState(false)
  const [message,  setMessage]  = useState<string | null>(null)

  const flash = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 3000) }

  const handleSave = async (item: RentalRow) => {
    setSaving(item.id)
    const res = await fetch(`/api/admin/rental-items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_per_day: item.price_per_day, available: item.available }),
    })
    setSaving(null)
    flash(res.ok ? '保存しました' : '保存に失敗しました')
  }

  const handleDisable = async (id: string) => {
    setSaving(id)
    const res = await fetch(`/api/admin/rental-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: false }),
    })
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, available: false } : i))
    } else {
      flash('無効化に失敗しました')
    }
    setSaving(null)
  }

  const handleAdd = async () => {
    if (!newName || !newPrice) return
    setAdding(true)
    const res  = await fetch('/api/admin/rental-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, price_per_day: Number(newPrice) }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems(prev => [...prev, data.item])
      setNewName(''); setNewPrice('')
      flash('追加しました')
    } else {
      flash('追加に失敗しました')
    }
    setAdding(false)
  }

  const update = (id: string, key: keyof RentalRow, value: number | boolean) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))

  return (
    <div className="space-y-4">
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg">{message}</div>
      )}

      {items.map(item => (
        <div key={item.id}
             className={`flex flex-wrap items-center gap-4 p-4 bg-white border rounded-xl
               ${item.available ? 'border-warm-200' : 'border-gray-200 opacity-50'}`}>
          <div className="flex-1 min-w-[120px]">
            <p className="font-medium text-warm-700 text-sm">{item.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-warm-400 text-sm">¥</span>
            <input type="number" value={item.price_per_day}
                   onChange={e => update(item.id, 'price_per_day', Number(e.target.value))}
                   className="w-20 border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700
                              focus:outline-none focus:border-warm-400" />
            <span className="text-xs text-warm-400">/泊</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${item.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {item.available ? '有効' : '無効'}
          </span>
          <button onClick={() => handleSave(item)} disabled={saving === item.id}
                  className="bg-warm-300 hover:bg-warm-400 disabled:opacity-60 text-white text-xs
                             font-bold px-3 py-1.5 rounded-lg transition-colors">
            {saving === item.id ? '...' : '保存'}
          </button>
          {item.available && (
            <button onClick={() => handleDisable(item.id)} disabled={saving === item.id}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1.5 rounded-lg">
              無効化
            </button>
          )}
        </div>
      ))}

      {/* 新規追加 */}
      <div className="p-4 bg-warm-50 border border-dashed border-warm-300 rounded-xl">
        <p className="text-sm font-medium text-warm-600 mb-3">新規追加</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-warm-400 mb-1">品名</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例：ランタン"
                   className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400 w-36" />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">1泊料金（円）</label>
            <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="500"
                   className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-warm-700 focus:outline-none focus:border-warm-400 w-24" />
          </div>
          <button onClick={handleAdd} disabled={adding || !newName || !newPrice}
                  className="bg-warm-600 hover:bg-warm-700 disabled:opacity-60 text-white text-sm
                             font-bold px-4 py-2 rounded-lg transition-colors">
            {adding ? '追加中...' : '+ 追加'}
          </button>
        </div>
      </div>
    </div>
  )
}
