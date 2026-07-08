'use client'
import { useMemo, useState } from 'react'

interface AccountOpt { id: string; code: string; name: string }
interface ItemOpt { id: string; name: string; unit: string; category: string; trackInventory: boolean }

interface Props {
  expenseAccounts: AccountOpt[]
  paymentAccounts: AccountOpt[]
  itemMaster: ItemOpt[]
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  createdTime: string
  imported: boolean
}

interface LineRow {
  key: string
  itemId: string
  itemName: string
  qty: string
  unitPrice: string
  subtotal: string
  accountCode: string
}

interface OcrDraftItem {
  name: string; qty: number; unitPrice: number; subtotal: number; accountCode: string
}
interface OcrDraft {
  date?: string; amount?: number; vendor?: string; suggestedAccountCode?: string
  items?: OcrDraftItem[]
}

const LS_KEY = 'expense_last_credit_account'

const uid = () => Math.random().toString(36).slice(2, 10)

const emptyRow = (accountCode = ''): LineRow => ({
  key: uid(), itemId: '', itemName: '', qty: '1', unitPrice: '', subtotal: '', accountCode,
})

export default function ExpenseReceiptForm({ expenseAccounts, paymentAccounts, itemMaster }: Props) {
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
  const [desc, setDesc]         = useState('')
  const [credit, setCredit]     = useState('')
  const [lines, setLines]       = useState<LineRow[]>([emptyRow()])

  // Google Drive
  const [driveOpen, setDriveOpen]     = useState(false)
  const [driveFiles, setDriveFiles]   = useState<DriveFile[] | null>(null)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveImporting, setDriveImporting] = useState<string | null>(null)

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.subtotal) || 0), 0),
    [lines],
  )

  const onPick = (f: File | null) => {
    setFile(f); setError(null); setDone(null); setSourceName(null)
    if (f && f.type === 'application/pdf') {
      setPreview(null)
      setSourceName(`📄 ${f.name}`)
    } else {
      setPreview(f ? URL.createObjectURL(f) : null)
    }
  }

  const lastCredit = () => (typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) ?? '' : '')

  const applyDraft = (
    d: OcrDraft,
    path: string,
    previewUrl?: string | null,
    ocrError?: string | null,
    ocrRaw?: string | null,
  ) => {
    setReceiptPath(path)
    if (previewUrl) setPreview(previewUrl)
    setDate(d.date || '')
    setDesc(d.vendor || '')
    setCredit(lastCredit() || paymentAccounts[0]?.id || '')

    const fallbackCode = d.suggestedAccountCode || ''
    const items = Array.isArray(d.items) ? d.items : []
    if (items.length > 0) {
      setLines(items.map(it => ({
        key: uid(),
        itemId: '',
        itemName: it.name,
        qty: String(it.qty || 1),
        unitPrice: it.unitPrice ? String(it.unitPrice) : '',
        subtotal: String(it.subtotal || 0),
        accountCode: it.accountCode || fallbackCode,
      })))
    } else if (d.amount && d.amount > 0) {
      // 明細抽出できないが合計は取れた: 1行に集約
      setLines([{
        key: uid(), itemId: '', itemName: d.vendor || 'レシート',
        qty: '1', unitPrice: String(d.amount), subtotal: String(d.amount),
        accountCode: fallbackCode,
      }])
    } else {
      setLines([emptyRow(fallbackCode)])
    }

    setStage('confirm')
    if (!d.date && (!items.length && !d.amount)) {
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
    if (driveFiles) return
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

  const updateLine = (key: string, patch: Partial<LineRow>) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l))
  }
  const addLine = () => setLines(prev => [...prev, emptyRow()])
  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const items = lines
        .filter(l => l.itemName.trim() && Number(l.subtotal) > 0)
        .map(l => ({
          itemId: l.itemId || null,
          itemName: l.itemName.trim(),
          quantity: Number(l.qty) || 1,
          unitPrice: l.unitPrice ? Number(l.unitPrice) : null,
          subtotal: Number(l.subtotal),
          accountCode: l.accountCode,
        }))
      if (items.length === 0) { setError('明細を1件以上入力してください'); return }
      if (items.some(i => !i.accountCode)) { setError('全ての明細に費用科目を設定してください'); return }

      const res = await fetch('/api/admin/accounting/post-expense', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, description: desc,
          creditAccountId: credit, receiptPath,
          items,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '記帳に失敗しました'); return }
      if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, credit)
      const stockMsg = json.stockUpdated > 0 ? `（在庫加算 ${json.stockUpdated} 品目）` : ''
      setDone(`記帳しました${stockMsg}`)
      setFile(null); setPreview(null); setReceiptPath(null); setStage('pick'); setSourceName(null)
      setDate(''); setDesc(''); setLines([emptyRow()])
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {done && <p className="text-green-600 text-sm">{done}</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {stage === 'pick' && (
        <div className="bg-white border border-warm-100 rounded-xl p-5 space-y-3 max-w-lg">
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
        <div className="bg-white border border-warm-100 rounded-xl p-5 space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-warm-500 mb-1">日付</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-warm-500 mb-1">摘要（店名など）</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
                className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-warm-600">仕入れ明細</label>
              <button onClick={addLine} className="text-xs bg-warm-100 hover:bg-warm-200 text-warm-700 px-2 py-1 rounded">+ 行を追加</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-warm-100">
                <thead className="bg-warm-50 text-warm-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-normal min-w-[140px]">商品名</th>
                    <th className="px-2 py-1.5 text-right font-normal w-14">数量</th>
                    <th className="px-2 py-1.5 text-right font-normal w-20">単価</th>
                    <th className="px-2 py-1.5 text-right font-normal w-20">小計</th>
                    <th className="px-2 py-1.5 text-left font-normal min-w-[110px]">費用科目</th>
                    <th className="px-2 py-1.5 text-left font-normal min-w-[130px]">商品マスタ紐付け</th>
                    <th className="px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.key} className="border-t border-warm-100">
                      <td className="px-1 py-1">
                        <input type="text" value={l.itemName}
                          onChange={e => updateLine(l.key, { itemName: e.target.value })}
                          className="w-full border border-warm-200 rounded px-2 py-1 text-xs" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" step="0.01" value={l.qty}
                          onChange={e => updateLine(l.key, { qty: e.target.value })}
                          className="w-full border border-warm-200 rounded px-1 py-1 text-xs text-right" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={l.unitPrice}
                          onChange={e => {
                            const up = e.target.value
                            const qtyN = Number(l.qty) || 1
                            const sub = up ? String(Math.round(Number(up) * qtyN)) : l.subtotal
                            updateLine(l.key, { unitPrice: up, subtotal: sub })
                          }}
                          className="w-full border border-warm-200 rounded px-1 py-1 text-xs text-right" />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={l.subtotal}
                          onChange={e => updateLine(l.key, { subtotal: e.target.value })}
                          className="w-full border border-warm-200 rounded px-1 py-1 text-xs text-right font-bold" />
                      </td>
                      <td className="px-1 py-1">
                        <select value={l.accountCode}
                          onChange={e => updateLine(l.key, { accountCode: e.target.value })}
                          className="w-full border border-warm-200 rounded px-1 py-1 text-xs">
                          <option value="">選択</option>
                          {expenseAccounts.map(a => <option key={a.id} value={a.code}>{a.code} {a.name}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <select value={l.itemId}
                          onChange={e => updateLine(l.key, { itemId: e.target.value })}
                          className="w-full border border-warm-200 rounded px-1 py-1 text-xs">
                          <option value="">紐付けなし</option>
                          {itemMaster.map(im => (
                            <option key={im.id} value={im.id}>
                              {im.name}{im.trackInventory ? ' 📦' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button onClick={() => removeLine(l.key)}
                          className="text-warm-400 hover:text-red-500 text-sm" title="削除">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-warm-50">
                  <tr className="border-t border-warm-200">
                    <td colSpan={3} className="px-2 py-2 text-right text-warm-500">合計</td>
                    <td className="px-2 py-2 text-right font-bold text-warm-700">¥{total.toLocaleString()}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[10px] text-warm-400 mt-1">📦 = 在庫追跡対象。紐付けると仕入時に在庫が自動加算されます。</p>
          </div>

          <div>
            <label className="block text-sm text-warm-500 mb-1">支払元（貸方）</label>
            <select value={credit} onChange={e => setCredit(e.target.value)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm max-w-xs">
              <option value="">選択してください</option>
              {paymentAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving || !date || !credit || total === 0}
              className="flex-1 bg-warm-500 hover:bg-warm-600 text-white font-bold py-2.5 rounded-lg text-sm disabled:opacity-40">
              {saving ? '記帳中...' : `この内容で記帳 ¥${total.toLocaleString()}`}
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
