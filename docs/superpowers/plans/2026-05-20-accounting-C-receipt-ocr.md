# 会計サブプロジェクトC：経費入力＋レシートOCR 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** レシートを撮影/選択すると Claude が日付・金額・店名・推定費用科目を読み取り、人が確認・修正して記帳すると証憑画像付きの経費仕訳（借 費用科目 / 貸 支払元）が複式簿記に登録される。

**Architecture:** 外部依存しない純粋ロジック（`parseOcrResult`・`buildExpenseEntry`）を TDD で固め、その上に Anthropic OCR API・経費記帳API・確認UIを載せる。OCRは補助で、失敗しても手入力で記帳継続できる。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin + Storage), `@anthropic-ai/sdk`, TypeScript, Vitest, TailwindCSS warm palette。

**参照スペック:** `docs/superpowers/specs/2026-05-20-accounting-C-receipt-ocr-design.md`

---

## 前提知識（実装者向け）

- サブA/Bで作成済み: `lib/accounting/types.ts`（`JournalEntryInput = { entryDate, description, lines: {accountId, side, amount}[] }`）、`lib/accounting/validateEntry.ts`（`validateEntry(entry): string|null`）、`lib/accounting/serverPosting.ts`。
- 勘定科目（`accounts`）: 費用は `category='expense'`（例 519消耗品費）。支払元候補コード: 現金=101, 普通預金=102, 未払金=202, 事業主借=303。
- `journal_entries` 列: entry_date, description, source, source_id, receipt_url（C で追加）。`journal_lines`: journal_entry_id, account_id, side, amount, line_order。
- admin API パターン: `createSupabaseServerClient()`（`@/lib/supabase-server`）で `auth.getSession()`→401、`supabaseAdmin`（`@/lib/supabase`）で DML/Storage。
- シェル: Bash（Git Bash）。PowerShell禁止。パス `C:/Users/biscu/Downloads/bluesky-camp`。金額は整数（円）。
- 既存の全テスト数は 113。

---

### Task 1: 依存追加とモデル定数

**Files:**
- Modify: `package.json`（`npm install`）
- Create: `lib/ocrConfig.ts`

- [ ] **Step 1: Anthropic SDK を追加**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm install @anthropic-ai/sdk 2>&1 | tail -3
```

- [ ] **Step 2: `lib/ocrConfig.ts` を作成**

```typescript
// OCR に使う Claude モデル。差し替えやすいよう定数化。
export const OCR_MODEL = 'claude-sonnet-4-20250514'
export const OCR_MAX_IMAGE_BYTES = 10 * 1024 * 1024  // 10MB
```

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add package.json package-lock.json lib/ocrConfig.ts && git commit -m "feat(accounting-c): add anthropic sdk and OCR config"
```

---

### Task 2: 純粋ロジック `parseOcrResult`

**Files:**
- Create: `lib/accounting/ocrReceipt.ts`
- Test: `lib/accounting/__tests__/ocrReceipt.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/accounting/__tests__/ocrReceipt.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { parseOcrResult } from '../ocrReceipt'

const CODES = ['511', '512', '519']

describe('parseOcrResult', () => {
  it('parses a clean JSON response', () => {
    const raw = JSON.stringify({ date: '2026-03-15', amount: 1200, vendor: 'コメリ', accountCode: '519', confidence: 'high' })
    expect(parseOcrResult(raw, CODES)).toEqual({
      date: '2026-03-15', amount: 1200, vendor: 'コメリ', suggestedAccountCode: '519', confidence: 'high',
    })
  })

  it('normalizes amount with ¥ and commas', () => {
    const raw = JSON.stringify({ date: '2026-03-15', amount: '¥1,200', vendor: 'A', accountCode: '519' })
    expect(parseOcrResult(raw, CODES).amount).toBe(1200)
  })

  it('strips 円 suffix from amount', () => {
    const raw = JSON.stringify({ amount: '3000円' })
    expect(parseOcrResult(raw, CODES).amount).toBe(3000)
  })

  it('blanks an invalid date', () => {
    const raw = JSON.stringify({ date: '不明', amount: 100 })
    expect(parseOcrResult(raw, CODES).date).toBe('')
  })

  it('blanks an account code not in the candidate list', () => {
    const raw = JSON.stringify({ accountCode: '999', amount: 100 })
    expect(parseOcrResult(raw, CODES).suggestedAccountCode).toBe('')
  })

  it('extracts JSON from a ```json fenced response', () => {
    const raw = '```json\n{"date":"2026-01-02","amount":500,"vendor":"B","accountCode":"511"}\n```'
    const d = parseOcrResult(raw, CODES)
    expect(d.date).toBe('2026-01-02')
    expect(d.amount).toBe(500)
    expect(d.suggestedAccountCode).toBe('511')
  })

  it('returns an all-empty draft for unparseable input (no throw)', () => {
    expect(parseOcrResult('totally not json', CODES)).toEqual({
      date: '', amount: 0, vendor: '', suggestedAccountCode: '', confidence: '',
    })
  })

  it('defaults amount to 0 when missing', () => {
    expect(parseOcrResult(JSON.stringify({ vendor: 'X' }), CODES).amount).toBe(0)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/ocrReceipt.test.ts 2>&1 | tail -10`
Expected: FAIL（parseOcrResult 未定義）

- [ ] **Step 3: 実装 `lib/accounting/ocrReceipt.ts`（parseOcrResult 部分）**

```typescript
import type { JournalEntryInput } from './types'

export interface OcrDraft {
  date: string
  amount: number
  vendor: string
  suggestedAccountCode: string
  confidence: 'low' | 'medium' | 'high' | ''
}

export interface ExpenseInput {
  date: string
  amount: number
  description: string
  debitAccountId: string
  creditAccountId: string
}

const EMPTY_DRAFT: OcrDraft = {
  date: '', amount: 0, vendor: '', suggestedAccountCode: '', confidence: '',
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  // ```json ... ``` フェンスを優先的に取り出す
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1] : raw
  // 最初の { から最後の } までを取り出して解析
  const start = candidate.indexOf('{')
  const end   = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    const obj = JSON.parse(candidate.slice(start, end + 1))
    return (obj && typeof obj === 'object') ? obj as Record<string, unknown> : null
  } catch {
    return null
  }
}

function normalizeAmount(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Number.isInteger(v) ? v : Math.round(v)
  if (typeof v === 'string') {
    const cleaned = v.replace(/[¥,円\s]/g, '')
    const n = Number(cleaned)
    if (Number.isFinite(n)) return Math.round(n)
  }
  return 0
}

export function parseOcrResult(raw: string, validExpenseCodes: string[]): OcrDraft {
  const obj = extractJson(raw)
  if (!obj) return { ...EMPTY_DRAFT }

  const dateRaw = typeof obj.date === 'string' ? obj.date : ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : ''

  const amount = normalizeAmount(obj.amount)

  const vendor = typeof obj.vendor === 'string' ? obj.vendor : ''

  const codeRaw = typeof obj.accountCode === 'string' ? obj.accountCode : ''
  const suggestedAccountCode = validExpenseCodes.includes(codeRaw) ? codeRaw : ''

  const conf = obj.confidence
  const confidence: OcrDraft['confidence'] =
    conf === 'low' || conf === 'medium' || conf === 'high' ? conf : ''

  return { date, amount, vendor, suggestedAccountCode, confidence }
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/ocrReceipt.test.ts 2>&1 | tail -10`
Expected: 8 passed

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/ocrReceipt.ts lib/accounting/__tests__/ocrReceipt.test.ts && git commit -m "feat(accounting-c): parseOcrResult pure logic + tests"
```

---

### Task 3: 純粋ロジック `buildExpenseEntry`

**Files:**
- Modify: `lib/accounting/ocrReceipt.ts`
- Modify: `lib/accounting/__tests__/ocrReceipt.test.ts`

- [ ] **Step 1: 失敗するテストを追加（`ocrReceipt.test.ts` の末尾に追記）**

```typescript
import { buildExpenseEntry } from '../ocrReceipt'
import { validateEntry } from '../validateEntry'

describe('buildExpenseEntry', () => {
  const base = {
    date: '2026-03-15', amount: 1200, description: 'コメリ',
    debitAccountId: 'acc-exp', creditAccountId: 'acc-cash',
  }
  it('builds a balanced expense entry that passes validateEntry', () => {
    const e = buildExpenseEntry(base)
    expect(e.entryDate).toBe('2026-03-15')
    expect(e.description).toBe('コメリ')
    expect(e.lines).toEqual([
      { accountId: 'acc-exp',  side: 'debit',  amount: 1200 },
      { accountId: 'acc-cash', side: 'credit', amount: 1200 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('defaults blank description to 経費', () => {
    expect(buildExpenseEntry({ ...base, description: '' }).description).toBe('経費')
  })
  it('throws on non-positive amount', () => {
    expect(() => buildExpenseEntry({ ...base, amount: 0 })).toThrow()
    expect(() => buildExpenseEntry({ ...base, amount: -5 })).toThrow()
  })
  it('throws on non-integer amount', () => {
    expect(() => buildExpenseEntry({ ...base, amount: 12.5 })).toThrow()
  })
  it('throws when debit and credit accounts are the same', () => {
    expect(() => buildExpenseEntry({ ...base, creditAccountId: 'acc-exp' })).toThrow()
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/ocrReceipt.test.ts 2>&1 | tail -10`
Expected: FAIL（buildExpenseEntry 未定義）

- [ ] **Step 3: `lib/accounting/ocrReceipt.ts` に追記**

ファイル末尾に追加:
```typescript
export function buildExpenseEntry(input: ExpenseInput): JournalEntryInput {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('金額は正の整数で入力してください')
  }
  if (input.debitAccountId === input.creditAccountId) {
    throw new Error('借方と貸方に同じ科目は指定できません')
  }
  return {
    entryDate: input.date,
    description: input.description || '経費',
    lines: [
      { accountId: input.debitAccountId,  side: 'debit',  amount: input.amount },
      { accountId: input.creditAccountId, side: 'credit', amount: input.amount },
    ],
  }
}
```

- [ ] **Step 4: テスト成功＋全テスト確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/ocrReceipt.test.ts 2>&1 | tail -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: ocrReceipt 13 passed、全体 pass（113 + 13 = 126）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/ocrReceipt.ts lib/accounting/__tests__/ocrReceipt.test.ts && git commit -m "feat(accounting-c): buildExpenseEntry pure logic + tests"
```

---

### Task 4: SQL マイグレーション（receipt_url）

**Files:** Create `supabase/migrations/011_journal_receipt.sql`

- [ ] **Step 1: 作成**

```sql
-- supabase/migrations/011_journal_receipt.sql
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS receipt_url text;
```

- [ ] **Step 2: コミット**（Supabase 実行・バケット作成は Task 8）

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/011_journal_receipt.sql && git commit -m "feat(accounting-c): add receipt_url to journal_entries"
```

---

### Task 5: OCR API ＋ 経費記帳API ＋ 署名URL API

**Files:**
- Create: `app/api/admin/accounting/ocr-receipt/route.ts`
- Create: `app/api/admin/accounting/post-expense/route.ts`
- Create: `app/api/admin/accounting/receipt-url/route.ts`

- [ ] **Step 1: `app/api/admin/accounting/ocr-receipt/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseOcrResult } from '@/lib/accounting/ocrReceipt'
import { OCR_MODEL, OCR_MAX_IMAGE_BYTES } from '@/lib/ocrConfig'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OCRは未設定です。手入力をご利用ください' }, { status: 400 })

  let file: File | null = null
  try {
    const form = await req.formData()
    file = form.get('image') as File | null
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: '画像がありません' }, { status: 400 })
  if (file.size > OCR_MAX_IMAGE_BYTES) return NextResponse.json({ error: '画像サイズが大きすぎます（10MBまで）' }, { status: 413 })

  const arrayBuf = await file.arrayBuffer()
  const bytes = Buffer.from(arrayBuf)
  const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  const path = `${ym}/${crypto.randomUUID()}.${ext}`

  // Storage 保存（失敗しても OCR は試みるが、保存失敗は致命的なので報告）
  const { error: upErr } = await supabaseAdmin.storage.from('receipts').upload(path, bytes, {
    contentType: file.type || 'image/jpeg', upsert: false,
  })
  if (upErr) return NextResponse.json({ error: `画像の保存に失敗しました: ${upErr.message}` }, { status: 500 })

  // 費用科目候補
  const { data: expenseAccounts } = await supabaseAdmin
    .from('accounts').select('code, name').eq('category', 'expense').eq('is_active', true).order('code')
  const candidates = (expenseAccounts ?? []).map(a => `${a.code}:${a.name}`).join(', ')
  const validCodes = (expenseAccounts ?? []).map(a => a.code as string)

  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'
  const base64 = bytes.toString('base64')

  // OCR 実行（失敗時は空下書きで返す＝手入力で続行可能）
  let draft = parseOcrResult('', validCodes)
  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: OCR_MODEL,
      max_tokens: 512,
      system: '日本のレシート画像から経費情報を抽出するアシスタント。必ずJSONのみを返す。説明文は不要。',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text:
            `このレシートから次をJSONで返してください:\n` +
            `{"date":"YYYY-MM-DD","amount":整数の合計金額,"vendor":"店名","accountCode":"下の候補から最適なコード","confidence":"low|medium|high"}\n` +
            `費用科目の候補: ${candidates}\n` +
            `読めない項目は空文字、accountCodeは候補のコードのみ。JSON以外は出力しない。` },
        ],
      }],
    })
    const text = msg.content.filter(c => c.type === 'text').map(c => (c as { text: string }).text).join('\n')
    draft = parseOcrResult(text, validCodes)
  } catch (e) {
    console.error('OCR failed:', e)
    // draft は空のまま
  }

  return NextResponse.json({ draft, receiptPath: path })
}
```

- [ ] **Step 2: `app/api/admin/accounting/post-expense/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildExpenseEntry } from '@/lib/accounting/ocrReceipt'
import { validateEntry } from '@/lib/accounting/validateEntry'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    date?: string; amount?: number; description?: string
    debitAccountId?: string; creditAccountId?: string; receiptPath?: string
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { date, amount, description, debitAccountId, creditAccountId, receiptPath } = body
  if (!date || !debitAccountId || !creditAccountId || typeof amount !== 'number')
    return NextResponse.json({ error: '日付・金額・科目が必要です' }, { status: 400 })

  // 科目の実在確認
  const { data: accs } = await supabaseAdmin.from('accounts').select('id').in('id', [debitAccountId, creditAccountId])
  if (!accs || accs.length < 2)
    return NextResponse.json({ error: '指定された科目が見つかりません' }, { status: 400 })

  let entry
  try {
    entry = buildExpenseEntry({ date, amount, description: description ?? '', debitAccountId, creditAccountId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '仕訳の組み立てに失敗しました' }, { status: 400 })
  }
  const err = validateEntry(entry)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({ entry_date: entry.entryDate, description: entry.description, source: 'expense', receipt_url: receiptPath ?? null })
    .select().single()
  if (headerErr || !header) return NextResponse.json({ error: headerErr?.message ?? '仕訳の作成に失敗しました' }, { status: 500 })

  const lines = entry.lines.map((l, i) => ({
    journal_entry_id: header.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }
  return NextResponse.json({ entryId: header.id })
}
```

- [ ] **Step 3: `app/api/admin/accounting/receipt-url/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path が必要です' }, { status: 400 })

  const { data, error } = await supabaseAdmin.storage.from('receipts').createSignedUrl(path, 300)
  if (error || !data) return NextResponse.json({ error: error?.message ?? '署名URLの発行に失敗しました' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
```

- [ ] **Step 4: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add app/api/admin/accounting/ocr-receipt app/api/admin/accounting/post-expense app/api/admin/accounting/receipt-url && git commit -m "feat(accounting-c): OCR, post-expense, and signed-url APIs"
```
Expected: 新規型エラーなし

---

### Task 6: 確認UI（ExpenseReceiptForm）＋ ページ ＋ 会計トップリンク

**Files:**
- Create: `components/admin/accounting/ExpenseReceiptForm.tsx`
- Create: `app/admin/(dashboard)/accounting/expense/page.tsx`
- Modify: `app/admin/(dashboard)/accounting/page.tsx`

- [ ] **Step 1: `components/admin/accounting/ExpenseReceiptForm.tsx` を作成**

```tsx
'use client'
import { useState } from 'react'

interface AccountOpt { id: string; code: string; name: string }
interface Props {
  expenseAccounts: AccountOpt[]   // 費用科目（借方候補）
  paymentAccounts: AccountOpt[]   // 支払元（貸方候補: 101/102/202/303）
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
      // OCR推定の費用科目（コード→ID）
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
      // リセット
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
```

- [ ] **Step 2: `app/admin/(dashboard)/accounting/expense/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import ExpenseReceiptForm from '@/components/admin/accounting/ExpenseReceiptForm'

export const revalidate = 0

const PAYMENT_CODES = ['101', '102', '202', '303']

export default async function ExpensePage() {
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('id, code, name, category, is_active').eq('is_active', true).order('code')

  const expenseAccounts = (accounts ?? [])
    .filter(a => a.category === 'expense')
    .map(a => ({ id: a.id, code: a.code, name: a.name }))
  const paymentAccounts = (accounts ?? [])
    .filter(a => PAYMENT_CODES.includes(a.code))
    .map(a => ({ id: a.id, code: a.code, name: a.name }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">レシート経費入力</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">レシートを撮影/選択して読み取り、内容を確認して記帳します。読み取れない場合は手で入力できます。</p>
      <ExpenseReceiptForm expenseAccounts={expenseAccounts} paymentAccounts={paymentAccounts} />
    </div>
  )
}
```

- [ ] **Step 3: `app/admin/(dashboard)/accounting/page.tsx` の LINKS に追加**

`LINKS` 配列の「予約売上計上」の次に追加:
```typescript
  { href: '/admin/accounting/expense', label: 'レシート経費入力', icon: '🧾' },
```

- [ ] **Step 4: 型チェック・ビルド・全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 型エラーなし・ビルド成功（`/admin/accounting/expense` がルート一覧に出る）・全テスト pass

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/admin/accounting/ExpenseReceiptForm.tsx "app/admin/(dashboard)/accounting/expense/page.tsx" "app/admin/(dashboard)/accounting/page.tsx" && git commit -m "feat(accounting-c): receipt expense entry UI + page + accounting link"
```

---

### Task 7: 仕訳帳でのレシート表示（任意の小改善）

**Files:** Modify `app/admin/(dashboard)/accounting/journal/page.tsx`

経費仕訳に証憑がある場合、仕訳帳から確認できるようにする。

- [ ] **Step 1: `journal/page.tsx` を読み、各仕訳に `receipt_url` を含めて取得**

`journal_entries` の select に `receipt_url` が含まれるよう確認（`select('*, journal_lines(*)')` なら既に含まれる）。Entry 型に `receipt_url?: string | null` を追加。

- [ ] **Step 2: 仕訳カードに証憑リンクを表示**

各仕訳カード内（摘要の近く）に、`receipt_url` があるとき表示:
```tsx
{e.receipt_url && (
  <a href={`/api/admin/accounting/receipt-url?path=${encodeURIComponent(e.receipt_url)}`}
     target="_blank" rel="noopener noreferrer"
     className="text-warm-500 text-xs underline hover:text-warm-700">🧾 レシート</a>
)}
```
注: このリンクは署名URLを返すJSONを開くだけなので、簡易に「別タブでJSONのurlを表示」になる。より良い体験にするなら、クライアントで fetch して `window.open(json.url)` する小コンポーネントにする。**最小実装としては JSON リンクで可**、もしくはクライアント側で以下のラッパーを作る:

`components/admin/accounting/ReceiptLink.tsx`:
```tsx
'use client'
export default function ReceiptLink({ path }: { path: string }) {
  const open = async () => {
    const res = await fetch(`/api/admin/accounting/receipt-url?path=${encodeURIComponent(path)}`)
    const json = await res.json()
    if (json.url) window.open(json.url, '_blank', 'noopener')
  }
  return <button onClick={open} className="text-warm-500 text-xs underline hover:text-warm-700">🧾 レシート</button>
}
```
仕訳カードで `{e.receipt_url && <ReceiptLink path={e.receipt_url} />}` を使う（journal/page.tsx に import）。**ReceiptLink 方式を採用する。**

- [ ] **Step 3: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add components/admin/accounting/ReceiptLink.tsx "app/admin/(dashboard)/accounting/journal/page.tsx" && git commit -m "feat(accounting-c): show receipt link in journal"
```

---

### Task 8: バケット作成 ＋ SQL 実行 ＋ 環境変数 ＋ デプロイ

**Files:** なし（インフラ作業）

- [ ] **Step 1: Supabase で `receipts` バケットを作成（手動・非公開）**

Supabase Dashboard → Storage → New bucket → 名前 `receipts`、Public を **オフ**（非公開）で作成。

- [ ] **Step 2: SQL マイグレーション 011 を実行**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && node -e "const fs=require('fs');const{spawnSync}=require('child_process');const t=fs.readFileSync('supabase/migrations/011_journal_receipt.sql','utf8').replace(/^﻿/,'');spawnSync('clip',{input:Buffer.from(t,'utf16le')});console.log('copied')"
```
翻訳オフの Chrome で `https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/sql/new` を開き貼り付けて Run。Expected: 「Success. No rows returned」

- [ ] **Step 3: receipt_url カラム確認**

```bash
node -e "
const https=require('https');
const k=process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGlhZmtkamVhc2xod2x2ZnhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3ODAyNSwiZXhwIjoyMDk0MTU0MDI1fQ.vg5_LezAvImZm8OA0CWdBnwY_kp9lj9UlE5rekZ4mhg';
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/journal_entries?select=id,receipt_url&limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('receipt_url:',r.statusCode===200?'OK':'ERR '+r.statusCode))
"
```
Expected: `receipt_url: OK`

- [ ] **Step 4: `ANTHROPIC_API_KEY` を Vercel に設定（ユーザー操作）**

ユーザーに Anthropic API キーを Vercel 環境変数 `ANTHROPIC_API_KEY`（Production）に設定してもらう。未設定でもデプロイは成功し、OCRのみ無効（手入力は可能）。

- [ ] **Step 5: デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`
