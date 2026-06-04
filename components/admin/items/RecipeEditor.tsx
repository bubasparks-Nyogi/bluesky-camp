'use client'
import { useState } from 'react'

interface ItemLite { id: string; name: string; category: string; unit: string }
interface Comp { id: string; component_item_id: string; quantity: number; items?: { name: string; unit: string; cost_price: number | null } }
interface Props {
  dishId: string
  ingredients: ItemLite[]
  initialComponents: Comp[]
}

export default function RecipeEditor({ dishId, ingredients, initialComponents }: Props) {
  const [comps, setComps] = useState<Comp[]>(initialComponents)
  const [compId, setCompId] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    setError(null)
    const res = await fetch(`/api/admin/items/${dishId}/components`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentItemId: compId, quantity: Number(qty) }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? '追加に失敗しました'); return }
    const ing = ingredients.find(i => i.id === compId)
    setComps(c => [...c, { id: crypto.randomUUID(), component_item_id: compId, quantity: Number(qty), items: ing ? { name: ing.name, unit: ing.unit, cost_price: null } : undefined }])
    setCompId(''); setQty('')
  }

  const remove = async (componentItemId: string) => {
    const res = await fetch(`/api/admin/items/${dishId}/components/${componentItemId}`, { method: 'DELETE' })
    if (res.ok) setComps(c => c.filter(x => x.component_item_id !== componentItemId))
  }

  return (
    <div className="mt-3 border-t border-warm-100 pt-3">
      <h4 className="text-sm font-bold text-warm-600 mb-2">レシピ（構成食材）</h4>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      <div className="space-y-1 mb-2">
        {comps.map(c => (
          <div key={c.component_item_id} className="flex items-center justify-between text-sm">
            <span className="text-warm-700">{c.items?.name ?? ingredients.find(i => i.id === c.component_item_id)?.name ?? c.component_item_id}</span>
            <span className="text-warm-500">{c.quantity} {c.items?.unit ?? ''}
              <button onClick={() => remove(c.component_item_id)} className="ml-3 text-red-500 hover:text-red-700 text-xs">削除</button>
            </span>
          </div>
        ))}
        {comps.length === 0 && <p className="text-warm-300 text-xs">構成食材が未登録です</p>}
      </div>
      <div className="flex gap-2">
        <select value={compId} onChange={e => setCompId(e.target.value)}
          className="flex-1 border border-warm-200 rounded-lg px-2 py-1 text-sm">
          <option value="">食材を選択</option>
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <input type="number" step="any" value={qty} onChange={e => setQty(e.target.value)} placeholder="数量"
          className="w-24 border border-warm-200 rounded-lg px-2 py-1 text-sm text-right" />
        <button onClick={add} disabled={!compId || !qty}
          className="bg-warm-300 hover:bg-warm-400 text-white px-3 py-1 rounded-lg text-sm disabled:opacity-40">追加</button>
      </div>
    </div>
  )
}
