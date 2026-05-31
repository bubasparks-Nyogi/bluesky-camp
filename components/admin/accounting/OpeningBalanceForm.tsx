'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Account { id: string; code: string; name: string; normal_balance: string }
interface OB { account_id: string; side: string; amount: number }

export default function OpeningBalanceForm({ accounts, year, initial }: {
  accounts: Account[]; year: number; initial: OB[]
}) {
  const router = useRouter()
  const initialMap = new Map(initial.map(o => [o.account_id, o.amount]))
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(accounts.map(a => [a.id, String(initialMap.get(a.id) ?? '')]))
  )
  const [savingId, setSavingId] = useState<string | null>(null)

  const save = async (a: Account) => {
    setSavingId(a.id)
    try {
      const amount = Number(values[a.id]) || 0
      await fetch('/api/admin/accounting/opening-balances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscal_year: year, account_id: a.id, side: a.normal_balance, amount }),
      })
      router.refresh()
    } finally { setSavingId(null) }
  }

  return (
    <table className="w-full text-sm bg-white border border-warm-100 rounded-xl overflow-hidden">
      <thead>
        <tr className="text-warm-400 border-b border-warm-100 text-left">
          <th className="py-2 px-3">科目</th><th className="px-3">通常残高</th>
          <th className="px-3">期首残高</th><th></th>
        </tr>
      </thead>
      <tbody>
        {accounts.map(a => (
          <tr key={a.id} className="border-b border-warm-50">
            <td className="py-2 px-3 text-warm-700">{a.code} {a.name}</td>
            <td className="px-3 text-warm-400">{a.normal_balance === 'debit' ? '借方' : '貸方'}</td>
            <td className="px-3">
              <input type="number" value={values[a.id] ?? ''}
                onChange={e => setValues(v => ({ ...v, [a.id]: e.target.value }))}
                className="border border-warm-200 rounded-lg px-2 py-1 text-sm text-right w-32" />
            </td>
            <td className="px-3 text-right">
              <button onClick={() => save(a)} disabled={savingId === a.id}
                className="text-xs bg-warm-100 text-warm-600 hover:bg-warm-200 px-3 py-1 rounded-lg">
                {savingId === a.id ? '保存中' : '保存'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
