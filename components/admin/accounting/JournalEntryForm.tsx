'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Account { id: string; code: string; name: string; is_active: boolean }
interface LineState { side: 'debit' | 'credit'; accountId: string; amount: string }

export default function JournalEntryForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const active = accounts.filter(a => a.is_active)
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [desc, setDesc]       = useState('')
  const [lines, setLines]     = useState<LineState[]>([
    { side: 'debit',  accountId: '', amount: '' },
    { side: 'credit', accountId: '', amount: '' },
  ])
  const [error, setError]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)

  const debitTotal  = lines.filter(l => l.side === 'debit').reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const creditTotal = lines.filter(l => l.side === 'credit').reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const balanced    = debitTotal === creditTotal && debitTotal > 0

  const setLine = (i: number, patch: Partial<LineState>) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const addLine = () => setLines(ls => [...ls, { side: 'debit', accountId: '', amount: '' }])
  const removeLine = (i: number) => setLines(ls => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls)

  const submit = async () => {
    setError(null); setSaving(true)
    try {
      const payload = {
        entryDate: date, description: desc,
        lines: lines.map(l => ({ accountId: l.accountId, side: l.side, amount: Number(l.amount) })),
      }
      const res = await fetch('/api/admin/accounting/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '保存に失敗しました'); return }
      setDesc('')
      setLines([{ side: 'debit', accountId: '', amount: '' }, { side: 'credit', accountId: '', amount: '' }])
      router.refresh()
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-warm-100 rounded-xl p-4 mb-6">
      <h2 className="font-bold text-warm-700 mb-3">新規仕訳</h2>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <div className="grid md:grid-cols-2 gap-2 mb-3">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-warm-200 rounded-lg px-3 py-2 text-sm" />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="摘要"
          className="border border-warm-200 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[90px_1fr_120px_32px] gap-2 items-center">
            <select value={l.side} onChange={e => setLine(i, { side: e.target.value as 'debit' | 'credit' })}
              className="border border-warm-200 rounded-lg px-2 py-2 text-sm">
              <option value="debit">借方</option>
              <option value="credit">貸方</option>
            </select>
            <select value={l.accountId} onChange={e => setLine(i, { accountId: e.target.value })}
              className="border border-warm-200 rounded-lg px-2 py-2 text-sm">
              <option value="">科目を選択</option>
              {active.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
            <input type="number" value={l.amount} onChange={e => setLine(i, { amount: e.target.value })}
              placeholder="金額" className="border border-warm-200 rounded-lg px-2 py-2 text-sm text-right" />
            <button onClick={() => removeLine(i)} className="text-warm-300 hover:text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>

      <button onClick={addLine} className="mt-2 text-warm-500 text-sm hover:text-warm-700">＋ 明細を追加</button>

      <div className={`mt-3 flex items-center justify-between text-sm font-medium ${balanced ? 'text-green-600' : 'text-red-500'}`}>
        <span>借方 ¥{debitTotal.toLocaleString()} / 貸方 ¥{creditTotal.toLocaleString()}</span>
        <span>{balanced ? '✓ 一致' : `差額 ¥${Math.abs(debitTotal - creditTotal).toLocaleString()}`}</span>
      </div>

      <button onClick={submit} disabled={!balanced || saving}
        className="mt-3 w-full bg-warm-500 hover:bg-warm-600 text-white font-bold py-2.5 rounded-lg disabled:opacity-40">
        {saving ? '保存中...' : '仕訳を登録'}
      </button>
    </div>
  )
}
