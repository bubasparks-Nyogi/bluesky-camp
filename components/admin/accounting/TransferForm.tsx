'use client'
import { useMemo, useState } from 'react'

interface AccOpt { id: string; code: string; name: string; category: string }
interface Props { accounts: AccOpt[] }

interface Preset {
  label: string
  emoji: string
  debitCode: string
  creditCode: string
  descTemplate: string
}

const PRESETS: Preset[] = [
  { label: 'カード引落し',       emoji: '💳', debitCode: '202', creditCode: '102', descTemplate: 'クレジットカード引落し' },
  { label: '電子マネーチャージ', emoji: '📱', debitCode: '106', creditCode: '102', descTemplate: '電子マネーチャージ' },
  { label: '現金 → 預金',         emoji: '🏦', debitCode: '102', creditCode: '101', descTemplate: '売上金入金' },
  { label: '預金 → 現金',         emoji: '💴', debitCode: '101', creditCode: '102', descTemplate: '両替・引出し' },
]

export default function TransferForm({ accounts }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [debit, setDebit] = useState('')
  const [credit, setCredit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const byCode = useMemo(() => {
    const m = new Map<string, AccOpt>()
    for (const a of accounts) m.set(a.code, a)
    return m
  }, [accounts])

  const applyPreset = (p: Preset) => {
    const d = byCode.get(p.debitCode)
    const c = byCode.get(p.creditCode)
    if (!d || !c) { setError(`科目コード ${p.debitCode} または ${p.creditCode} が見つかりません`); return }
    setDebit(d.id); setCredit(c.id)
    if (!desc.trim()) setDesc(p.descTemplate)
    setError(null); setDone(null)
  }

  const submit = async () => {
    setSaving(true); setError(null); setDone(null)
    try {
      const res = await fetch('/api/admin/accounting/transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, amount: Number(amount), description: desc,
          debitAccountId: debit, creditAccountId: credit,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '記帳に失敗しました'); return }
      setDone('✓ 振替仕訳を記帳しました')
      setAmount(''); setDesc('')
    } finally { setSaving(false) }
  }

  const debitAcc  = accounts.find(a => a.id === debit)
  const creditAcc = accounts.find(a => a.id === credit)
  const amountNum = Number(amount) || 0

  return (
    <div className="space-y-4 max-w-2xl">
      {done && <p className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg p-3">{done}</p>}
      {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <div className="bg-white border border-warm-100 rounded-xl p-4">
        <p className="text-xs font-bold text-warm-600 mb-2">よく使うテンプレート</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className="bg-warm-50 hover:bg-warm-100 text-warm-700 text-xs font-bold p-3 rounded-lg border border-warm-100 text-left">
              <div className="text-lg mb-1">{p.emoji}</div>
              <div>{p.label}</div>
              <div className="text-[10px] text-warm-400 font-normal mt-1">
                借:{p.debitCode} / 貸:{p.creditCode}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-warm-100 rounded-xl p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-warm-500 mb-1">日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-warm-500 mb-1">金額</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm text-right" placeholder="0" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-warm-500 mb-1">摘要</label>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="例: 2026年7月分カード引落し"
            className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-warm-500 mb-1">借方（増える科目）</label>
            <select value={debit} onChange={e => setDebit(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm">
              <option value="">選択してください</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-warm-500 mb-1">貸方（減る科目）</label>
            <select value={credit} onChange={e => setCredit(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm">
              <option value="">選択してください</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
        </div>

        {debitAcc && creditAcc && amountNum > 0 && (
          <div className="bg-warm-50 border border-warm-100 rounded-lg p-3 text-sm">
            <p className="text-warm-500 text-xs mb-1">プレビュー</p>
            <p className="tabular-nums text-warm-700">
              借方: {debitAcc.code} {debitAcc.name} <span className="float-right">¥{amountNum.toLocaleString()}</span>
            </p>
            <p className="tabular-nums text-warm-700">
              貸方: {creditAcc.code} {creditAcc.name} <span className="float-right">¥{amountNum.toLocaleString()}</span>
            </p>
          </div>
        )}

        <button onClick={submit}
          disabled={saving || !date || !debit || !credit || amountNum <= 0}
          className="w-full bg-warm-500 hover:bg-warm-600 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-40">
          {saving ? '記帳中...' : `この内容で記帳 ¥${amountNum.toLocaleString()}`}
        </button>
      </div>
    </div>
  )
}
