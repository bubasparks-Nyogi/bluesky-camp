'use client'
import { useState } from 'react'

interface AccountOpt { id: string; code: string; name: string }
interface Props {
  expenseAccounts: AccountOpt[]
  paymentAccounts: AccountOpt[]
}

const LS_KEY = 'expense_last_credit_account'

export default function ExpenseReceiptForm({ expenseAccounts, paymentAccounts }: Props) {
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const [reading, setReading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [stage, setStage]       = useState<'pick' | 'confirm'>('pick')
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [done, setDone]         = useState<string | null>(null)

  const [date, setDate]         = useState('')
  const [amount, setAmount]     = useState('')
  const [desc, setDesc]         = useState('')
  const [debit, setDebit]       = useState('')
  const [credit, setCredit]     = useState('')

  const onPick = (f: File | null) => {
    setFile(f); setError(null); setDone(null)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  const lastCredit = () => (typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) ?? '' : '')

  const read = async () => {
    if (!file) return
    setReading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/admin/accounting/ocr-receipt', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '読み取りに失敗しました'); return }
      const d = json.draft
      setReceiptPath(json.receiptPath)
      setDate(d.date || '')
      setAmount(d.amount ? String(d.amount) : '')
      setDesc(d.vendor || '')
      const matched = expenseAccounts.find(a => a.code === d.suggestedAccountCode)
      setDebit(matched?.id ?? '')
      setCredit(lastCredit() || paymentAccounts[0]?.id || '')
      setStage('confirm')
      if (!d.date && !d.amount) setError('読み取れませんでした。手で入力してください')
    } finally { setReading(false) }
  }

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/accounting/post-expense', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, amount: Number(amount), description: desc,
          debitAccountId: debit, creditAccountId: credit, receiptPath,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '記帳に失敗しました'); return }
      if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, credit)
      setDone('記帳しました')
      setFile(null); setPreview(null); setReceiptPath(null); setStage('pick')
      setDate(''); setAmount(''); setDesc(''); setDebit('')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-lg">
      {done && <p className="text-green-600 text-sm">{done}</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {stage === 'pick' && (
        <div className="bg-white border border-warm-100 rounded-xl p-5 space-y-3">
          <input type="file" accept="image/*" capture="environment"
            onChange={e => onPick(e.target.files?.[0] ?? null)}
            className="block w-full text-sm" />
          {preview && <img src={preview} alt="プレビュー" className="max-h-64 rounded-lg border border-warm-100" />}
          <button onClick={read} disabled={!file || reading}
            className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40">
            {reading ? '読み取り中...' : 'レシートを読み取る'}
          </button>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="bg-white border border-warm-100 rounded-xl p-5 space-y-3">
          {preview && <img src={preview} alt="レシート" className="max-h-48 rounded-lg border border-warm-100" />}
          <div>
            <label className="block text-sm text-warm-500 mb-1">日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-warm-500 mb-1">金額</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-right" />
          </div>
          <div>
            <label className="block text-sm text-warm-500 mb-1">摘要</label>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="店名など"
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-warm-500 mb-1">費用科目（借方）</label>
            <select value={debit} onChange={e => setDebit(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm">
              <option value="">選択してください</option>
              {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-warm-500 mb-1">支払元（貸方）</label>
            <select value={credit} onChange={e => setCredit(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm">
              <option value="">選択してください</option>
              {paymentAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving || !date || !amount || !debit || !credit}
              className="flex-1 bg-warm-500 hover:bg-warm-600 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-40">
              {saving ? '記帳中...' : 'この内容で記帳'}
            </button>
            <button onClick={() => { setStage('pick'); setError(null) }}
              className="px-4 py-2.5 border border-warm-200 text-warm-500 hover:bg-warm-100 rounded-lg text-sm">
              やり直す
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
