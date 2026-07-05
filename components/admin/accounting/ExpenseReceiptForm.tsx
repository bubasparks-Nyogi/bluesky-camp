'use client'
import { useState } from 'react'

interface AccountOpt { id: string; code: string; name: string }
interface Props {
  expenseAccounts: AccountOpt[]
  paymentAccounts: AccountOpt[]
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  createdTime: string
  imported: boolean
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
  const [sourceName, setSourceName] = useState<string | null>(null)

  const [date, setDate]         = useState('')
  const [amount, setAmount]     = useState('')
  const [desc, setDesc]         = useState('')
  const [debit, setDebit]       = useState('')
  const [credit, setCredit]     = useState('')

  // Google Drive
  const [driveOpen, setDriveOpen]     = useState(false)
  const [driveFiles, setDriveFiles]   = useState<DriveFile[] | null>(null)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveImporting, setDriveImporting] = useState<string | null>(null)

  const onPick = (f: File | null) => {
    setFile(f); setError(null); setDone(null); setSourceName(null)
    // PDF は img プレビュー不可のためファイル名表示に切替
    if (f && f.type === 'application/pdf') {
      setPreview(null)
      setSourceName(`📄 ${f.name}`)
    } else {
      setPreview(f ? URL.createObjectURL(f) : null)
    }
  }

  const lastCredit = () => (typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) ?? '' : '')

  const applyDraft = (
    d: { date?: string; amount?: number; vendor?: string; suggestedAccountCode?: string },
    path: string,
    previewUrl?: string | null,
    ocrError?: string | null,
    ocrRaw?: string | null,
  ) => {
    setReceiptPath(path)
    if (previewUrl) setPreview(previewUrl)
    setDate(d.date || '')
    setAmount(d.amount ? String(d.amount) : '')
    setDesc(d.vendor || '')
    const matched = expenseAccounts.find(a => a.code === d.suggestedAccountCode)
    setDebit(matched?.id ?? '')
    setCredit(lastCredit() || paymentAccounts[0]?.id || '')
    setStage('confirm')
    if (!d.date && !d.amount) {
      if (ocrError)     setError(`読み取れませんでした: ${ocrError}`)
      else if (ocrRaw)  setError(`読み取れませんでした（Claude 応答: ${ocrRaw.slice(0, 120)}...）`)
      else              setError('読み取れませんでした。手で入力してください')
    }
  }

  const read = async () => {
    if (!file) return
    setReading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/admin/accounting/ocr-receipt', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '読み取りに失敗しました'); return }
      applyDraft(json.draft, json.receiptPath, json.previewUrl, json.ocrError, json.ocrRaw)
    } finally { setReading(false) }
  }

  const openDrive = async () => {
    setDriveOpen(true); setError(null)
    if (driveFiles) return  // 既に取得済み
    setDriveLoading(true)
    try {
      const res = await fetch('/api/admin/drive-receipts')
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Drive の取得に失敗しました'); setDriveOpen(false); return }
      setDriveFiles(json.files ?? [])
    } finally { setDriveLoading(false) }
  }

  const importFromDrive = async (f: DriveFile) => {
    if (f.imported && !confirm(`「${f.name}」は取込済みです。もう一度取り込みますか？（二重計上にご注意）`)) return
    setDriveImporting(f.id); setError(null)
    try {
      const res = await fetch('/api/admin/drive-receipts/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: f.id, fileName: f.name }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '取込に失敗しました'); return }
      setSourceName(f.name)
      setPreview(null)
      setDriveFiles(prev => prev?.map(x => x.id === f.id ? { ...x, imported: true } : x) ?? null)
      setDriveOpen(false)
      applyDraft(json.draft, json.receiptPath, json.previewUrl, json.ocrError, json.ocrRaw)
    } finally { setDriveImporting(null) }
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
      setFile(null); setPreview(null); setReceiptPath(null); setStage('pick'); setSourceName(null)
      setDate(''); setAmount(''); setDesc(''); setDebit('')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-lg">
      {done && <p className="text-green-600 text-sm">{done}</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {stage === 'pick' && (
        <div className="bg-white border border-warm-100 rounded-xl p-5 space-y-3">
          <input type="file" accept="image/*,application/pdf" capture="environment"
            onChange={e => onPick(e.target.files?.[0] ?? null)}
            className="block w-full text-sm" />
          {preview && <img src={preview} alt="プレビュー" className="max-h-64 rounded-lg border border-warm-100" />}
          {!preview && sourceName && (
            <p className="text-xs text-warm-500 bg-warm-50 rounded px-3 py-2">{sourceName}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={read} disabled={!file || reading}
              className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40">
              {reading ? '読み取り中...' : 'レシートを読み取る'}
            </button>
            <button onClick={openDrive} disabled={driveLoading}
              className="bg-warm-100 hover:bg-warm-200 text-warm-700 font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40">
              {driveLoading ? '取得中...' : '📁 Google Driveから選ぶ'}
            </button>
          </div>

          {driveOpen && driveFiles && (
            <div className="border border-warm-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-warm-50 border-b border-warm-100 flex items-center justify-between">
                <span className="text-xs font-bold text-warm-600">仕入れレシートフォルダ（新しい順・最大50件）</span>
                <button onClick={() => setDriveOpen(false)} className="text-warm-400 text-xs hover:text-warm-600">閉じる ✕</button>
              </div>
              {driveFiles.length === 0 ? (
                <p className="px-3 py-4 text-center text-warm-400 text-sm">フォルダにファイルがありません</p>
              ) : (
                <div className="divide-y divide-warm-100 max-h-72 overflow-y-auto">
                  {driveFiles.map(f => (
                    <button key={f.id} onClick={() => importFromDrive(f)}
                      disabled={driveImporting !== null}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-warm-50 disabled:opacity-50">
                      <div className="min-w-0">
                        <p className="text-sm text-warm-700 truncate">{f.name}</p>
                        <p className="text-xs text-warm-400">{f.createdTime.slice(0, 10)}</p>
                      </div>
                      <span className="shrink-0 ml-2 text-xs">
                        {driveImporting === f.id ? (
                          <span className="text-warm-500">読取中...</span>
                        ) : f.imported ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">済</span>
                        ) : (
                          <span className="text-warm-400">→</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {stage === 'confirm' && (
        <div className="bg-white border border-warm-100 rounded-xl p-5 space-y-3">
          {preview && (
            preview.toLowerCase().includes('.pdf') || preview.toLowerCase().includes('pdf')
              ? <a href={preview} target="_blank" rel="noopener noreferrer"
                  className="inline-block bg-warm-100 text-warm-700 px-3 py-2 rounded text-sm hover:bg-warm-200">
                  📄 PDF を別タブで開く
                </a>
              : <img src={preview} alt="レシート" className="max-h-64 rounded-lg border border-warm-100" />
          )}
          {sourceName && (
            <p className="text-xs text-warm-500 bg-warm-50 rounded px-3 py-2">📁 Google Drive: {sourceName}</p>
          )}
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
            <button onClick={() => { setStage('pick'); setError(null); setSourceName(null) }}
              className="px-4 py-2.5 border border-warm-200 text-warm-500 hover:bg-warm-100 rounded-lg text-sm">
              やり直す
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
