'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Account {
  id: string
  code: string
  name: string
  category: string
  normal_balance: string
  is_active: boolean
  sort_order: number
}

const CATEGORY_LABEL: Record<string, string> = {
  asset: '資産', liability: '負債', equity: '純資産', revenue: '収益', expense: '費用',
}

export default function AccountManager({ initialAccounts }: { initialAccounts: Account[] }) {
  const router = useRouter()
  const [accounts, setAccounts] = useState(initialAccounts)
  const [code, setCode]         = useState('')
  const [name, setName]         = useState('')
  const [category, setCategory] = useState('expense')
  const [normal, setNormal]     = useState('debit')
  const [error, setError]       = useState<string | null>(null)

  const add = async () => {
    setError(null)
    const res = await fetch('/api/admin/accounting/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, category, normal_balance: normal }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? '追加に失敗しました'); return }
    setAccounts(a => [...a, json.account])
    setCode(''); setName('')
    router.refresh()
  }

  const toggleActive = async (a: Account) => {
    const res = await fetch(`/api/admin/accounting/accounts/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !a.is_active }),
    })
    if (res.ok) setAccounts(list => list.map(x => x.id === a.id ? { ...x, is_active: !a.is_active } : x))
  }

  const remove = async (a: Account) => {
    if (!confirm(`科目「${a.name}」を削除しますか？`)) return
    const res = await fetch(`/api/admin/accounting/accounts/${a.id}`, { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (res.ok) setAccounts(list => list.filter(x => x.id !== a.id))
    else alert(json.error ?? '削除できませんでした')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-warm-100 rounded-xl p-4">
        <h2 className="font-bold text-warm-700 mb-3">科目を追加</h2>
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <div className="grid md:grid-cols-5 gap-2">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="コード"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="科目名"
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm">
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={normal} onChange={e => setNormal(e.target.value)}
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm">
            <option value="debit">借方が増</option>
            <option value="credit">貸方が増</option>
          </select>
        </div>
        <button onClick={add} className="mt-3 bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm">追加</button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-warm-400 border-b border-warm-100">
            <th className="py-2">コード</th><th>科目名</th><th>区分</th><th>通常</th><th>状態</th><th></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id} className="border-b border-warm-50">
              <td className="py-2 font-mono text-warm-500">{a.code}</td>
              <td className="text-warm-700">{a.name}</td>
              <td className="text-warm-500">{CATEGORY_LABEL[a.category] ?? a.category}</td>
              <td className="text-warm-400">{a.normal_balance === 'debit' ? '借方' : '貸方'}</td>
              <td>
                <button onClick={() => toggleActive(a)}
                  className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-400'}`}>
                  {a.is_active ? '有効' : '無効'}
                </button>
              </td>
              <td className="text-right">
                <button onClick={() => remove(a)} className="text-xs text-red-500 hover:text-red-700">削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
