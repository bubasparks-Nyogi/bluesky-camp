# 会計サブプロジェクトB：売上連携 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予約のライフサイクル（事前入金→宿泊完了→キャンセル）に対応する複式簿記仕訳を、管理画面操作から正確かつ二重なく自動生成する。

**Architecture:** 仕訳の組み立ては純粋関数 `lib/accounting/reservationPosting.ts`（TDD）。DB への保存・冪等チェック・科目コード解決はサーバ共通関数 `lib/accounting/serverPosting.ts` に集約し、売上計上API・入金更新API・キャンセルフックから再利用する。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin), TypeScript, Vitest, TailwindCSS warm palette。

**参照スペック:** `docs/superpowers/specs/2026-05-20-accounting-B-revenue-design.md`

---

## 前提知識（実装者向け）

- サブプロジェクトAで作成済み: `lib/accounting/{types,validateEntry}.ts`、`accounts`/`journal_entries`/`journal_lines` テーブル。`JournalEntryInput = { entryDate: string; description: string; lines: { accountId; side: 'debit'|'credit'; amount: number }[] }`。`validateEntry(entry): string | null` は借貸一致を検証。
- admin API パターン: `createSupabaseServerClient()` で `auth.getSession()`（401）、`supabaseAdmin`（`@/lib/supabase`）で DML。
- `journal_entries` には `source`（'manual'|'reservation'|'depreciation'）と `source_id`（text）列がある。B では `source='reservation'`、`source_id='{予約ID}:{phase}'`。
- キャンセル料: `calcCancellationFee(checkinDate, totalAmount, today?)` → `{ fee, rate, label }`（`@/lib/cancellation`）。
- 既存キャンセル経路は2つ: 公開 `app/api/reservations/[id]/cancel/route.ts`、管理 `app/api/admin/reservations/[id]/status/route.ts`（status を 'cancelled' に更新可能）。
- 勘定科目コード: 現金=101, 普通預金=102, 売掛金=103, 前受金=203, 売上高=401, 雑収入=402。
- シェル: Bash（Git Bash）。PowerShell禁止。パスは `C:/Users/biscu/Downloads/bluesky-camp`。金額は整数（円）。

---

### Task 1: SQL マイグレーション（reservations に支払項目）

**Files:** Create `supabase/migrations/009_reservation_payment.sql`

- [ ] **Step 1: 作成**

```sql
-- supabase/migrations/009_reservation_payment.sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method text;  -- 'onsite' | 'prepaid' | NULL
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS paid_at date;          -- 入金日（事前振込のみ）
```

- [ ] **Step 2: コミット**（Supabase 実行は Task 6）

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/009_reservation_payment.sql && git commit -m "feat(accounting-b): add payment_method and paid_at to reservations"
```

---

### Task 2: 純粋ロジック `reservationPosting.ts`

**Files:**
- Create: `lib/accounting/reservationPosting.ts`
- Test: `lib/accounting/__tests__/reservationPosting.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/accounting/__tests__/reservationPosting.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildReservationEntry, filterPostableReservations } from '../reservationPosting'
import type { ReservationForPosting, AccountCodeMap } from '../reservationPosting'
import { validateEntry } from '../validateEntry'

const MAP: AccountCodeMap = {
  '101': 'id-cash', '102': 'id-bank', '103': 'id-receivable',
  '203': 'id-advance', '401': 'id-sales', '402': 'id-misc',
}

const prepaid: ReservationForPosting = {
  id: 'r1', totalAmount: 20000, paymentMethod: 'prepaid',
  checkinDate: '2026-03-10', checkoutDate: '2026-03-11',
}
const onsite: ReservationForPosting = {
  id: 'r2', totalAmount: 15000, paymentMethod: 'onsite',
  checkinDate: '2026-03-10', checkoutDate: '2026-03-11',
}

describe('buildReservationEntry - prepayment', () => {
  it('prepaid → 借 普通預金 / 貸 前受金', () => {
    const e = buildReservationEntry(prepaid, 'prepayment', MAP, { paidAt: '2026-02-20' })!
    expect(e.entryDate).toBe('2026-02-20')
    expect(e.lines).toEqual([
      { accountId: 'id-bank',    side: 'debit',  amount: 20000 },
      { accountId: 'id-advance', side: 'credit', amount: 20000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('onsite → null', () => {
    expect(buildReservationEntry(onsite, 'prepayment', MAP, { paidAt: '2026-02-20' })).toBeNull()
  })
})

describe('buildReservationEntry - revenue', () => {
  it('prepaid → 借 前受金 / 貸 売上高 on checkout date', () => {
    const e = buildReservationEntry(prepaid, 'revenue', MAP)!
    expect(e.entryDate).toBe('2026-03-11')
    expect(e.lines).toEqual([
      { accountId: 'id-advance', side: 'debit',  amount: 20000 },
      { accountId: 'id-sales',   side: 'credit', amount: 20000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('onsite → 借 現金 / 貸 売上高', () => {
    const e = buildReservationEntry(onsite, 'revenue', MAP)!
    expect(e.lines).toEqual([
      { accountId: 'id-cash',  side: 'debit',  amount: 15000 },
      { accountId: 'id-sales', side: 'credit', amount: 15000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
})

describe('buildReservationEntry - cancellation', () => {
  it('prepaid + fee>0 → 借 前受金 / 貸 雑収入+普通預金, balanced', () => {
    const e = buildReservationEntry(prepaid, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 10000 })!
    expect(e.entryDate).toBe('2026-03-05')
    expect(e.lines).toEqual([
      { accountId: 'id-advance', side: 'debit',  amount: 20000 },
      { accountId: 'id-misc',    side: 'credit', amount: 10000 },
      { accountId: 'id-bank',    side: 'credit', amount: 10000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('prepaid + fee=total → no refund line', () => {
    const e = buildReservationEntry(prepaid, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 20000 })!
    expect(e.lines).toEqual([
      { accountId: 'id-advance', side: 'debit',  amount: 20000 },
      { accountId: 'id-misc',    side: 'credit', amount: 20000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('prepaid + fee=0 → no misc line (full refund)', () => {
    const e = buildReservationEntry(prepaid, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 0 })!
    expect(e.lines).toEqual([
      { accountId: 'id-advance', side: 'debit',  amount: 20000 },
      { accountId: 'id-bank',    side: 'credit', amount: 20000 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
  it('onsite + fee=0 → null', () => {
    expect(buildReservationEntry(onsite, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 0 })).toBeNull()
  })
  it('onsite + fee>0 → 借 売掛金 / 貸 雑収入', () => {
    const e = buildReservationEntry(onsite, 'cancellation', MAP, { cancelledAt: '2026-03-05', fee: 7500 })!
    expect(e.lines).toEqual([
      { accountId: 'id-receivable', side: 'debit',  amount: 7500 },
      { accountId: 'id-misc',       side: 'credit', amount: 7500 },
    ])
    expect(validateEntry(e)).toBeNull()
  })
})

describe('filterPostableReservations', () => {
  const base = {
    total_amount: 10000, payment_method: 'onsite', checkin_date: '2026-03-01',
    checkout_date: '2026-03-02', status: 'confirmed',
  }
  it('includes confirmed, past-checkout, payment set, not yet posted, not cancelled', () => {
    const rows = [{ id: 'a', ...base }]
    const out = filterPostableReservations(rows, '2026-03-10', new Set())
    expect(out.map(r => r.id)).toEqual(['a'])
  })
  it('excludes future checkout', () => {
    const rows = [{ id: 'a', ...base, checkout_date: '2026-12-31' }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set())).toHaveLength(0)
  })
  it('excludes non-confirmed', () => {
    const rows = [{ id: 'a', ...base, status: 'pending' }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set())).toHaveLength(0)
  })
  it('excludes missing payment_method', () => {
    const rows = [{ id: 'a', ...base, payment_method: null }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set())).toHaveLength(0)
  })
  it('excludes already-posted', () => {
    const rows = [{ id: 'a', ...base }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set(['a']))).toHaveLength(0)
  })
  it('excludes cancelled', () => {
    const rows = [{ id: 'a', ...base, status: 'cancelled' }]
    expect(filterPostableReservations(rows, '2026-03-10', new Set())).toHaveLength(0)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/reservationPosting.test.ts 2>&1 | tail -10`
Expected: FAIL（関数未定義）

- [ ] **Step 3: 実装 `lib/accounting/reservationPosting.ts`**

```typescript
import type { JournalEntryInput, JournalLineInput } from './types'

export type PaymentMethod = 'onsite' | 'prepaid'
export type PostingPhase  = 'prepayment' | 'revenue' | 'cancellation'

export interface ReservationForPosting {
  id: string
  totalAmount: number
  paymentMethod: PaymentMethod
  checkinDate: string
  checkoutDate: string
}

/** 科目コード → account_id の解決マップ */
export type AccountCodeMap = Record<string, string>

const CODE = {
  cash: '101', bank: '102', receivable: '103',
  advance: '203', sales: '401', misc: '402',
} as const

interface BuildOpts {
  paidAt?: string
  cancelledAt?: string
  fee?: number
}

export function buildReservationEntry(
  r: ReservationForPosting,
  phase: PostingPhase,
  accountMap: AccountCodeMap,
  opts: BuildOpts = {},
): JournalEntryInput | null {
  const acc = (code: string) => accountMap[code]
  const line = (code: string, side: 'debit' | 'credit', amount: number): JournalLineInput =>
    ({ accountId: acc(code), side, amount })

  if (phase === 'prepayment') {
    if (r.paymentMethod !== 'prepaid') return null
    return {
      entryDate: opts.paidAt ?? r.checkinDate,
      description: `前受金 予約${r.id}`,
      lines: [
        line(CODE.bank, 'debit', r.totalAmount),
        line(CODE.advance, 'credit', r.totalAmount),
      ],
    }
  }

  if (phase === 'revenue') {
    const debitCode = r.paymentMethod === 'prepaid' ? CODE.advance : CODE.cash
    return {
      entryDate: r.checkoutDate,
      description: `売上 予約${r.id}`,
      lines: [
        line(debitCode, 'debit', r.totalAmount),
        line(CODE.sales, 'credit', r.totalAmount),
      ],
    }
  }

  // cancellation
  const fee = opts.fee ?? 0
  const entryDate = opts.cancelledAt ?? r.checkoutDate
  const description = `キャンセル 予約${r.id}`

  if (r.paymentMethod === 'prepaid') {
    const refund = r.totalAmount - fee
    const lines: JournalLineInput[] = [line(CODE.advance, 'debit', r.totalAmount)]
    if (fee > 0)    lines.push(line(CODE.misc, 'credit', fee))
    if (refund > 0) lines.push(line(CODE.bank, 'credit', refund))
    return { entryDate, description, lines }
  }

  // onsite
  if (fee <= 0) return null
  return {
    entryDate, description,
    lines: [
      line(CODE.receivable, 'debit', fee),
      line(CODE.misc, 'credit', fee),
    ],
  }
}

/** 売上計上待ちの抽出（DB行のスネークケースを受け取る） */
interface ReservationRow {
  id: string
  total_amount: number
  payment_method: string | null
  checkin_date: string
  checkout_date: string
  status: string
}

export function filterPostableReservations(
  rows: ReservationRow[],
  today: string,
  postedRevenueIds: Set<string>,
): ReservationForPosting[] {
  return rows
    .filter(r =>
      r.status === 'confirmed' &&
      r.checkout_date <= today &&
      (r.payment_method === 'onsite' || r.payment_method === 'prepaid') &&
      !postedRevenueIds.has(r.id),
    )
    .map(r => ({
      id: r.id,
      totalAmount: r.total_amount,
      paymentMethod: r.payment_method as PaymentMethod,
      checkinDate: r.checkin_date,
      checkoutDate: r.checkout_date,
    }))
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/reservationPosting.test.ts 2>&1 | tail -10`
Expected: 全ケース pass（buildReservationEntry 9 + filterPostableReservations 6 = 15）

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/reservationPosting.ts lib/accounting/__tests__/reservationPosting.test.ts && git commit -m "feat(accounting-b): reservation posting pure logic + tests"
```

---

### Task 3: サーバ共通関数 `serverPosting.ts`

**Files:** Create `lib/accounting/serverPosting.ts`

冪等チェック・科目コード解決・仕訳保存を一箇所に集約。post-reservation API・入金更新API・キャンセルフックから再利用。

- [ ] **Step 1: 作成 `lib/accounting/serverPosting.ts`**

```typescript
import { supabaseAdmin } from '@/lib/supabase'
import { validateEntry } from './validateEntry'
import {
  buildReservationEntry,
  type ReservationForPosting,
  type PostingPhase,
  type AccountCodeMap,
} from './reservationPosting'

export interface PostResult {
  status: 'posted' | 'skipped' | 'error'
  entryId?: string
  error?: string
}

/** accounts テーブルから コード→ID マップを構築 */
async function buildAccountMap(): Promise<AccountCodeMap> {
  const { data } = await supabaseAdmin.from('accounts').select('id, code')
  const map: AccountCodeMap = {}
  for (const a of data ?? []) map[a.code] = a.id
  return map
}

/**
 * 予約に対する仕訳を冪等に生成・保存する。
 * 既に同じ source_id があれば skipped。生成結果が null（仕訳不要）も skipped。
 */
export async function postReservationEntry(
  reservation: ReservationForPosting,
  phase: PostingPhase,
  opts: { paidAt?: string; cancelledAt?: string; fee?: number } = {},
): Promise<PostResult> {
  const sourceId = `${reservation.id}:${phase}`

  // 冪等: 既存チェック
  const { data: existing } = await supabaseAdmin
    .from('journal_entries')
    .select('id')
    .eq('source', 'reservation')
    .eq('source_id', sourceId)
    .maybeSingle()
  if (existing) return { status: 'skipped' }

  const accountMap = await buildAccountMap()

  // 必要科目の存在確認
  const required = ['101', '102', '103', '203', '401', '402']
  for (const code of required) {
    if (!accountMap[code]) {
      return { status: 'error', error: `必要な勘定科目（コード${code}）が見つかりません` }
    }
  }

  const entry = buildReservationEntry(reservation, phase, accountMap, opts)
  if (!entry) return { status: 'skipped' }

  const err = validateEntry(entry)
  if (err) return { status: 'error', error: err }

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      entry_date: entry.entryDate,
      description: entry.description,
      source: 'reservation',
      source_id: sourceId,
    })
    .select().single()
  if (headerErr || !header) return { status: 'error', error: headerErr?.message ?? '仕訳の作成に失敗しました' }

  const lines = entry.lines.map((l, i) => ({
    journal_entry_id: header.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)
    return { status: 'error', error: linesErr.message }
  }
  return { status: 'posted', entryId: header.id }
}

/** その予約に前受金 or 売上の仕訳が既に存在するか（キャンセル要否判定用） */
export async function hasPostedEntries(reservationId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('journal_entries')
    .select('source_id')
    .eq('source', 'reservation')
    .in('source_id', [`${reservationId}:prepayment`, `${reservationId}:revenue`])
    .limit(1)
  return (data ?? []).length > 0
}
```

- [ ] **Step 2: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add lib/accounting/serverPosting.ts && git commit -m "feat(accounting-b): server-side idempotent posting helper"
```
Expected: 新規型エラーなし

---

### Task 4: 売上計上API ＋ 入金更新API

**Files:**
- Create: `app/api/admin/accounting/post-reservation/route.ts`
- Create: `app/api/admin/reservations/[id]/payment/route.ts`

- [ ] **Step 1: `app/api/admin/accounting/post-reservation/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { postReservationEntry } from '@/lib/accounting/serverPosting'
import type { ReservationForPosting, PaymentMethod } from '@/lib/accounting/reservationPosting'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reservationId?: string; phase?: 'prepayment' | 'revenue' }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { reservationId, phase } = body
  if (!reservationId || (phase !== 'prepayment' && phase !== 'revenue'))
    return NextResponse.json({ error: 'reservationId と phase が必要です' }, { status: 400 })

  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('id, total_amount, payment_method, checkin_date, checkout_date, paid_at')
    .eq('id', reservationId).maybeSingle()
  if (!r) return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
  if (r.payment_method !== 'onsite' && r.payment_method !== 'prepaid')
    return NextResponse.json({ error: '支払方法が未設定です' }, { status: 400 })

  const reservation: ReservationForPosting = {
    id: r.id, totalAmount: r.total_amount, paymentMethod: r.payment_method as PaymentMethod,
    checkinDate: r.checkin_date, checkoutDate: r.checkout_date,
  }
  const result = await postReservationEntry(reservation, phase, { paidAt: r.paid_at ?? undefined })
  if (result.status === 'error') return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}
```

- [ ] **Step 2: `app/api/admin/reservations/[id]/payment/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { postReservationEntry } from '@/lib/accounting/serverPosting'
import type { ReservationForPosting, PaymentMethod } from '@/lib/accounting/reservationPosting'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { payment_method?: string; paid_at?: string | null }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (body.payment_method !== undefined) {
    if (body.payment_method !== 'onsite' && body.payment_method !== 'prepaid' && body.payment_method !== null)
      return NextResponse.json({ error: 'payment_method が不正です' }, { status: 400 })
    update.payment_method = body.payment_method
  }
  if (body.paid_at !== undefined) update.paid_at = body.paid_at || null
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })

  const { error: upErr } = await supabaseAdmin.from('reservations').update(update).eq('id', params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // 事前振込＋入金日あり → 前受金仕訳を同期生成（冪等）
  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('id, total_amount, payment_method, checkin_date, checkout_date, paid_at')
    .eq('id', params.id).maybeSingle()

  if (r && r.payment_method === 'prepaid' && r.paid_at) {
    const reservation: ReservationForPosting = {
      id: r.id, totalAmount: r.total_amount, paymentMethod: 'prepaid',
      checkinDate: r.checkin_date, checkoutDate: r.checkout_date,
    }
    const result = await postReservationEntry(reservation, 'prepayment', { paidAt: r.paid_at })
    if (result.status === 'error')
      return NextResponse.json({ error: `前受金仕訳の生成に失敗: ${result.error}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add "app/api/admin/accounting/post-reservation/route.ts" "app/api/admin/reservations/[id]/payment/route.ts" && git commit -m "feat(accounting-b): post-reservation and payment-update APIs"
```

---

### Task 5: キャンセルフック

**Files:**
- Create: `lib/accounting/cancelHook.ts`
- Modify: `app/api/reservations/[id]/cancel/route.ts`
- Modify: `app/api/admin/reservations/[id]/status/route.ts`

- [ ] **Step 1: 作成 `lib/accounting/cancelHook.ts`**

```typescript
import { supabaseAdmin } from '@/lib/supabase'
import { calcCancellationFee } from '@/lib/cancellation'
import { postReservationEntry, hasPostedEntries } from './serverPosting'
import type { ReservationForPosting, PaymentMethod } from './reservationPosting'

/**
 * 予約キャンセル時の会計仕訳を best-effort で生成する。
 * 失敗してもスロー/拒否しない（呼び出し元のキャンセル処理は止めない）。
 */
export async function postCancellationEntry(reservationId: string): Promise<void> {
  try {
    const posted = await hasPostedEntries(reservationId)
    if (!posted) return  // 計上前キャンセルは何もしない

    const { data: r } = await supabaseAdmin
      .from('reservations')
      .select('id, total_amount, payment_method, checkin_date, checkout_date')
      .eq('id', reservationId).maybeSingle()
    if (!r || (r.payment_method !== 'onsite' && r.payment_method !== 'prepaid')) return

    const fee = calcCancellationFee(r.checkin_date, r.total_amount).fee
    const reservation: ReservationForPosting = {
      id: r.id, totalAmount: r.total_amount, paymentMethod: r.payment_method as PaymentMethod,
      checkinDate: r.checkin_date, checkoutDate: r.checkout_date,
    }
    await postReservationEntry(reservation, 'cancellation', {
      cancelledAt: new Date().toISOString().slice(0, 10),
      fee,
    })
  } catch (e) {
    console.error('postCancellationEntry failed:', e)
  }
}
```

- [ ] **Step 2: 公開キャンセルAPIにフック追加**

`app/api/reservations/[id]/cancel/route.ts` の冒頭 import に追加:
```typescript
import { postCancellationEntry } from '@/lib/accounting/cancelHook'
```
`sendCancellationEmails(reservation, feeResult).catch(console.error)` の直後に追加:
```typescript
  // 会計仕訳（best-effort）
  postCancellationEntry(params.id).catch(console.error)
```

- [ ] **Step 3: 管理ステータスAPIにフック追加**

`app/api/admin/reservations/[id]/status/route.ts` の import に追加:
```typescript
import { postCancellationEntry } from '@/lib/accounting/cancelHook'
```
更新成功後（`if (error) ...` の後、`return` の前）に追加:
```typescript
  if (status === 'cancelled') {
    postCancellationEntry(params.id).catch(console.error)
  }
```

- [ ] **Step 4: 型チェック＋テスト＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/cancelHook.ts "app/api/reservations/[id]/cancel/route.ts" "app/api/admin/reservations/[id]/status/route.ts" && git commit -m "feat(accounting-b): cancellation accounting hook (best-effort)"
```
Expected: 型エラーなし・全テスト pass

---

### Task 6: UI（予約売上計上ページ＋支払方法/入金日入力＋会計トップリンク）

**Files:**
- Create: `components/admin/accounting/ReservationPostingList.tsx`
- Create: `app/admin/(dashboard)/accounting/reservation-posting/page.tsx`
- Modify: `components/admin/ReservationEditForm.tsx`
- Modify: `app/admin/(dashboard)/accounting/page.tsx`

- [ ] **Step 1: `components/admin/accounting/ReservationPostingList.tsx` を作成**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Postable {
  id: string
  guestName: string
  checkinDate: string
  checkoutDate: string
  totalAmount: number
  paymentMethod: string
}

const PM_LABEL: Record<string, string> = { onsite: '現地払い', prepaid: '事前振込' }

export default function ReservationPostingList({ initial }: { initial: Postable[] }) {
  const router = useRouter()
  const [items, setItems]   = useState(initial)
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<Record<string, string>>({})

  const postOne = async (id: string): Promise<boolean> => {
    const res = await fetch('/api/admin/accounting/post-reservation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId: id, phase: 'revenue' }),
    })
    const json = await res.json()
    if (!res.ok) { setMsg(m => ({ ...m, [id]: json.error ?? '失敗' })); return false }
    setMsg(m => ({ ...m, [id]: json.status === 'skipped' ? 'スキップ（計上済み）' : '✓ 計上しました' }))
    return true
  }

  const postSelected = async (id: string) => {
    setBusy(true)
    const ok = await postOne(id)
    if (ok) setItems(list => list.filter(x => x.id !== id))
    setBusy(false)
    router.refresh()
  }

  const postAll = async () => {
    setBusy(true)
    const ids = items.map(x => x.id)
    const remaining: Postable[] = []
    for (const id of ids) {
      const ok = await postOne(id)
      if (!ok) remaining.push(items.find(x => x.id === id)!)
    }
    setItems(remaining)
    setBusy(false)
    router.refresh()
  }

  if (items.length === 0) {
    return <p className="text-warm-400 text-sm">売上計上待ちの予約はありません。</p>
  }

  return (
    <div className="space-y-4">
      <button onClick={postAll} disabled={busy}
        className="bg-warm-500 hover:bg-warm-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40">
        {busy ? '処理中...' : `全部計上（${items.length}件）`}
      </button>
      <div className="space-y-2">
        {items.map(r => (
          <div key={r.id} className="bg-white border border-warm-100 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-warm-700">{r.guestName}</span>
                <span className="text-xs bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">{PM_LABEL[r.paymentMethod] ?? r.paymentMethod}</span>
              </div>
              <p className="text-warm-500 text-sm mt-1">{r.checkinDate} 〜 {r.checkoutDate} · ¥{r.totalAmount.toLocaleString()}</p>
              {msg[r.id] && <p className="text-xs mt-1 text-warm-600">{msg[r.id]}</p>}
            </div>
            <button onClick={() => postSelected(r.id)} disabled={busy}
              className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 shrink-0">
              計上
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `app/admin/(dashboard)/accounting/reservation-posting/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { filterPostableReservations } from '@/lib/accounting/reservationPosting'
import ReservationPostingList from '@/components/admin/accounting/ReservationPostingList'

export const revalidate = 0

export default async function ReservationPostingPage() {
  const today = new Date().toISOString().slice(0, 10)

  const { data: rows } = await supabaseAdmin
    .from('reservations')
    .select('id, guest_name, total_amount, payment_method, checkin_date, checkout_date, status')
    .lte('checkout_date', today)
    .eq('status', 'confirmed')

  // 既に売上計上済みの予約ID集合
  const { data: posted } = await supabaseAdmin
    .from('journal_entries')
    .select('source_id')
    .eq('source', 'reservation')
    .like('source_id', '%:revenue')
  const postedIds = new Set((posted ?? []).map(p => (p.source_id as string).replace(':revenue', '')))

  const postable = filterPostableReservations(rows ?? [], today, postedIds)
  const nameById = new Map((rows ?? []).map(r => [r.id, r.guest_name as string]))

  const initial = postable.map(r => ({
    id: r.id,
    guestName: nameById.get(r.id) ?? '—',
    checkinDate: r.checkinDate,
    checkoutDate: r.checkoutDate,
    totalAmount: r.totalAmount,
    paymentMethod: r.paymentMethod,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">予約売上計上</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">チェックアウト日を過ぎた確定予約のうち、まだ売上計上していないものを表示しています。</p>
      <ReservationPostingList initial={initial} />
    </div>
  )
}
```

- [ ] **Step 3: `app/admin/(dashboard)/accounting/page.tsx` の LINKS に追加**

`LINKS` 配列の先頭（仕訳帳の前）に追加:
```typescript
  { href: '/admin/accounting/reservation-posting', label: '予約売上計上', icon: '💰' },
```

- [ ] **Step 4: `components/admin/ReservationEditForm.tsx` に支払方法・入金日を追加**

Read the file fully first. フォーム state に `payment_method` と `paid_at` を追加し、保存処理で `PATCH /api/admin/reservations/{id}/payment` を呼ぶ。具体的には:

(a) state 初期化（`useState({...})` 内）に追加:
```typescript
    payment_method:   (init as { payment_method?: string }).payment_method ?? '',
    paid_at:          (init as { paid_at?: string }).paid_at ?? '',
```

(b) フォームの「ステータス」入力の近くに、支払方法と入金日の入力ブロックを追加（既存の入力要素のスタイルに合わせる。クラスは近隣の input/select に倣う）:
```tsx
        <div>
          <label className="block text-sm text-warm-500 mb-1">支払方法</label>
          <select
            value={form.payment_method}
            onChange={e => setForm({ ...form, payment_method: e.target.value })}
            className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">未設定</option>
            <option value="onsite">現地払い</option>
            <option value="prepaid">事前振込</option>
          </select>
        </div>
        {form.payment_method === 'prepaid' && (
          <div>
            <label className="block text-sm text-warm-500 mb-1">入金日</label>
            <input
              type="date"
              value={form.paid_at}
              onChange={e => setForm({ ...form, paid_at: e.target.value })}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-warm-300 text-xs mt-1">入金日を保存すると前受金の仕訳が自動計上されます。</p>
          </div>
        )}
```

(c) 既存の保存ハンドラ（予約更新を行っている関数）の中で、予約更新成功の後に支払情報も保存する fetch を追加:
```typescript
      await fetch(`/api/admin/reservations/${init.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: form.payment_method || null,
          paid_at:        form.payment_method === 'prepaid' ? (form.paid_at || null) : null,
        }),
      })
```
（既存の保存処理の構造に合わせて挿入すること。`init.id` が予約IDを指す前提。違う場合は適切なID参照に置き換える。）

- [ ] **Step 5: 型チェック・ビルド・全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 型エラーなし・ビルド成功（`/admin/accounting/reservation-posting` がルート一覧に出る）・全テスト pass

- [ ] **Step 6: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add components/admin/accounting/ReservationPostingList.tsx "app/admin/(dashboard)/accounting/reservation-posting/page.tsx" components/admin/ReservationEditForm.tsx "app/admin/(dashboard)/accounting/page.tsx" && git commit -m "feat(accounting-b): reservation posting UI + payment fields + accounting link"
```

---

### Task 7: SQL 実行＋デプロイ

**Files:** なし

- [ ] **Step 1: SQL を UTF-16LE でクリップボードにコピー（日本語なし・ASCIIのみだが手順統一）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && node -e "const fs=require('fs');const{spawnSync}=require('child_process');const t=fs.readFileSync('supabase/migrations/009_reservation_payment.sql','utf8').replace(/^﻿/,'');spawnSync('clip',{input:Buffer.from(t,'utf16le')});console.log('copied')"
```

- [ ] **Step 2: Supabase SQL エディタで実行**

`https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/sql/new` を翻訳オフの Chrome で開き、貼り付けて Run。
Expected: 「Success. No rows returned」

- [ ] **Step 3: カラム追加を確認**

```bash
node -e "
const https=require('https');
const k='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGlhZmtkamVhc2xod2x2ZnhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3ODAyNSwiZXhwIjoyMDk0MTU0MDI1fQ.vg5_LezAvImZm8OA0CWdBnwY_kp9lj9UlE5rekZ4mhg';
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/reservations?select=id,payment_method,paid_at&limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('payment cols:',r.statusCode===200?'OK':'ERR '+r.statusCode))
"
```
Expected: `payment cols: OK`

- [ ] **Step 4: デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`
