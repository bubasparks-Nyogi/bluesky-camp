'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import RecipeEditor from './RecipeEditor'

interface Item {
  id: string; name: string; category: string; unit: string
  sale_price: number | null; cost_price: number | null
  is_sellable: boolean; track_inventory: boolean; is_active: boolean
}
interface Comp { id: string; component_item_id: string; quantity: number; items?: { name: string; unit: string; cost_price: number | null } }
interface Props {
  initialItems: Item[]
  dishCost: Record<string, { cost: number; hasMissingCost: boolean }>
  componentsByDish: Record<string, Comp[]>
}

const CATS = [
  { value: 'ingredient', label: '食材' }, { value: 'dish', label: '料理' },
  { value: 'goods', label: '物販' }, { value: 'drink', label: 'ドリンク' }, { value: 'supply', label: '消耗品' },
]
const catLabel = (v: string) => CATS.find(c => c.value === v)?.label ?? v

export default function ItemManager({ initialItems, dishCost, componentsByDish }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [form, setForm] = useState({ name: '', category: 'ingredient', unit: '個', salePrice: '', costPrice: '', isSellable: false, trackInventory: true })
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const ingredients = items.filter(i => i.is_active).map(i => ({ id: i.id, name: i.name, category: i.category, unit: i.unit }))

  const add = async () => {
    setError(null)
    const res = await fetch('/api/admin/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, category: form.category, unit: form.unit,
        salePrice: form.salePrice === '' ? null : Number(form.salePrice),
        costPrice: form.costPrice === '' ? null : Number(form.costPrice),
        isSellable: form.isSellable, trackInventory: form.trackInventory,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? '追加に失敗しました'); return }
    setItems(i => [...i, json.item])
    setForm({ name: '', category: 'ingredient', unit: '個', salePrice: '', costPrice: '', isSellable: false, trackInventory: true })
    router.refresh()
  }

  const toggleActive = async (it: Item) => {
    const res = await fetch(`/api/admin/items/${it.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: it.name, category: it.category, unit: it.unit,
        salePrice: it.sale_price, costPrice: it.cost_price,
        isSellable: it.is_sellable, trackInventory: it.track_inventory,
        isActive: !it.is_active,
      }),
    })
    if (res.ok) setItems(list => list.map(x => x.id === it.id ? { ...x, is_active: !it.is_active } : x))
  }

  const remove = async (it: Item) => {
    if (!confirm(`「${it.name}」を削除しますか？`)) return
    const res = await fetch(`/api/admin/items/${it.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (res.ok) setItems(list => list.filter(x => x.id !== it.id))
    else alert(json.error ?? '削除できませんでした')
  }

  const shown = filter === 'all' ? items : items.filter(i => i.category === filter)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-warm-100 rounded-xl p-4">
        <h2 className="font-bold text-warm-700 mb-3">品目を追加</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <div className="grid md:grid-cols-3 gap-2">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="名称"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm">
            {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="単位（個/g/食）"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm" />
          <input type="number" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} placeholder="販売価格"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-right" />
          <input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} placeholder="原価"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm text-right" />
        </div>
        <div className="flex gap-4 mt-2 text-sm text-warm-600">
          <label className="flex items-center gap-1"><input type="checkbox" checked={form.isSellable} onChange={e => setForm({ ...form, isSellable: e.target.checked })} /> 販売可</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={form.trackInventory} onChange={e => setForm({ ...form, trackInventory: e.target.checked })} /> 在庫管理</label>
        </div>
        <button onClick={add} className="mt-3 bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm">追加</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('all')} className={`text-xs px-3 py-1 rounded-full border ${filter==='all'?'bg-warm-500 text-white border-warm-500':'border-warm-200 text-warm-500'}`}>すべて</button>
        {CATS.map(c => <button key={c.value} onClick={() => setFilter(c.value)} className={`text-xs px-3 py-1 rounded-full border ${filter===c.value?'bg-warm-500 text-white border-warm-500':'border-warm-200 text-warm-500'}`}>{c.label}</button>)}
      </div>

      <div className="space-y-2">
        {shown.map(it => (
          <div key={it.id} className={`border rounded-xl p-4 ${it.is_active ? 'bg-white border-warm-100' : 'bg-warm-50 border-warm-200 opacity-70'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-warm-700">{it.name}</span>
                  <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">{catLabel(it.category)}</span>
                  {it.is_sellable && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">販売可</span>}
                  {it.track_inventory && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">在庫</span>}
                </div>
                <p className="text-warm-500 text-sm mt-1">
                  単位 {it.unit}
                  {it.sale_price != null && ` ・ 販売 ¥${it.sale_price.toLocaleString()}`}
                  {it.cost_price != null && ` ・ 原価 ¥${it.cost_price.toLocaleString()}`}
                  {it.category === 'dish' && dishCost[it.id] && ` ・ 料理原価 ¥${dishCost[it.id].cost.toLocaleString()}${dishCost[it.id].hasMissingCost ? '（原価未設定の食材あり）' : ''}`}
                </p>
                {it.category === 'dish' && (
                  <RecipeEditor dishId={it.id} ingredients={ingredients.filter(i => i.id !== it.id)} initialComponents={componentsByDish[it.id] ?? []} />
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => toggleActive(it)} className={`text-xs px-3 py-1 rounded-lg ${it.is_active ? 'bg-warm-100 text-warm-600 hover:bg-warm-200' : 'bg-green-500 text-white hover:bg-green-600'}`}>{it.is_active ? '無効化' : '有効化'}</button>
                <button onClick={() => remove(it)} className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">削除</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
