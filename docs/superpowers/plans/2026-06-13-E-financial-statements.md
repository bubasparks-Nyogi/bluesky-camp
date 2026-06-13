# サブプロジェクト E：決算書（P/L・B/S・青色申告 CSV）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存 `journal_entries` / `journal_lines` を集計し、損益計算書 (P/L) と貸借対照表 (B/S) を画面表示。年次/月次切替、弥生・freee 形式の仕訳 CSV エクスポート。

**Architecture:** 純粋関数（`aggregatePeriod` / `applyTaxMapping` / `yayoiExport` / `freeeExport`）を TDD で固め、薄い API ルートと Next.js Server Component から呼ぶ。マッピング表はコード化して `lib/accounting/taxMapping.ts` に集約。文字コードは弥生=Shift_JIS、freee=UTF-8+BOM。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin), TypeScript, Vitest, `iconv-lite`, TailwindCSS warm-* palette。

**参照スペック:** `docs/superpowers/specs/2026-06-13-E-financial-statements-design.md`

---

## 前提知識（実装者向け）

- ブランチ: `feat/e-financial-statements`（スペックコミット済）。
- 既存テスト総数: **221 件**。完了時 **240 件**（+19: aggregatePeriod 6, applyTaxMapping 5, yayoiExport 4, freeeExport 4）。
- 実コードは `supabase/migrations/008_accounting_core.sql` に定義済み:
  - 資産: 101 現金 / 102 普通預金 / 103 売掛金 / 104 前払金 / 105 繰越商品（B-4 で追加） / 151 工具器具備品 / 152 建物 / 153 車両運搬具
  - 負債: 201 買掛金 / 202 未払金 / 203 前受金 / 204 預り金 / 211 借入金
  - 資本: 301 元入金 / 302 事業主貸 / 303 事業主借
  - 収益: 401 売上高 / 402 雑収入
  - 費用: 501 仕入高 / 511 租税公課 / 512 水道光熱費 / 513 旅費交通費 / 514 通信費 / 515 広告宣伝費 / 516 接待交際費 / 517 損害保険料 / 518 修繕費 / 519 消耗品費 / 520 減価償却費 / 521 福利厚生費 / 522 給料賃金 / 523 外注工賃 / 524 利子割引料 / 525 地代家賃 / 526 支払手数料 / 530 雑費
- 既存 admin layout: `app/admin/(dashboard)/layout.tsx` に「🧮 会計」リンクあり。
- 既存 admin auth pattern: `createSupabaseServerClient()` + `getUser()`。
- パス: `"C:/Users/biscu/Downloads/bluesky-camp"`、Bash (Git Bash)。
- Pre-existing tsc errors in `types/reservation.test.ts` are unrelated — ignore.

---

### Task 1: 科目マッピング定数 `taxMapping`

**Files:**
- Create: `lib/accounting/taxMapping.ts`

純粋データ定義（ロジックなし、テストなし）。

- [ ] **Step 1: 作成**

```typescript
// lib/accounting/taxMapping.ts
// 青色申告書フォーマットに対応する科目マッピング

export interface PlCategory {
  key: string
  label: string
  accountCodes: readonly string[]
}

export const PL_REVENUE: PlCategory = {
  key: 'revenue',
  label: '売上（収入）金額',
  accountCodes: ['401', '402'],   // 売上高 + 雑収入
}

export const PL_PURCHASES: PlCategory = {
  key: 'purchases',
  label: '仕入金額',
  accountCodes: ['501'],
}

export const PL_TAX_CATEGORIES: readonly PlCategory[] = [
  { key: 'salary',        label: '給料賃金',     accountCodes: ['522'] },
  { key: 'outsourcing',   label: '外注工賃',     accountCodes: ['523'] },
  { key: 'depreciation',  label: '減価償却費',   accountCodes: ['520'] },
  { key: 'rent',          label: '地代家賃',     accountCodes: ['525'] },
  { key: 'interest',      label: '利子割引料',   accountCodes: ['524'] },
  { key: 'tax',           label: '租税公課',     accountCodes: ['511'] },
  { key: 'utility',       label: '水道光熱費',   accountCodes: ['512'] },
  { key: 'travel',        label: '旅費交通費',   accountCodes: ['513'] },
  { key: 'communication', label: '通信費',       accountCodes: ['514'] },
  { key: 'advertising',   label: '広告宣伝費',   accountCodes: ['515'] },
  { key: 'entertainment', label: '接待交際費',   accountCodes: ['516'] },
  { key: 'insurance',     label: '損害保険料',   accountCodes: ['517'] },
  { key: 'repair',        label: '修繕費',       accountCodes: ['518'] },
  { key: 'supplies',      label: '消耗品費',     accountCodes: ['519'] },
  { key: 'welfare',       label: '福利厚生費',   accountCodes: ['521'] },
  { key: 'fee',           label: '支払手数料',   accountCodes: ['526'] },
  { key: 'other_expense', label: '雑費',         accountCodes: ['530'] },
]

export interface BsCategory {
  key: string
  label: string
  section: 'asset' | 'liability' | 'equity'
  accountCodes?: readonly string[]
  codePrefix?: string
  computed?: 'netIncome'
}

export const BS_CATEGORIES: readonly BsCategory[] = [
  { key: 'cashEquivalents', label: '現金・預金',   section: 'asset',     accountCodes: ['101', '102'] },
  { key: 'receivables',     label: '売掛金',       section: 'asset',     accountCodes: ['103'] },
  { key: 'prepayments',     label: '前払金',       section: 'asset',     accountCodes: ['104'] },
  { key: 'inventory',       label: '棚卸資産',     section: 'asset',     accountCodes: ['105'] },
  { key: 'fixedAssets',     label: '固定資産',     section: 'asset',     codePrefix: '15' },
  { key: 'payables',        label: '買掛金',       section: 'liability', accountCodes: ['201'] },
  { key: 'unpaid',          label: '未払金',       section: 'liability', accountCodes: ['202'] },
  { key: 'advanceReceived', label: '前受金',       section: 'liability', accountCodes: ['203'] },
  { key: 'deposits',        label: '預り金',       section: 'liability', accountCodes: ['204'] },
  { key: 'loans',           label: '借入金',       section: 'liability', accountCodes: ['211'] },
  { key: 'capital',         label: '元入金',       section: 'equity',    accountCodes: ['301'] },
  { key: 'ownerDrawing',    label: '事業主貸',     section: 'equity',    accountCodes: ['302'] },
  { key: 'ownerLoan',       label: '事業主借',     section: 'equity',    accountCodes: ['303'] },
  { key: 'netIncome',       label: '当期純利益',   section: 'equity',    computed: 'netIncome' },
]
```

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -5
```

- [ ] **Step 3: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/taxMapping.ts && git commit -m "feat(e): taxMapping constants for 青色申告 P/L+B/S categories"
```

---

### Task 2: 純粋ロジック `aggregatePeriod`（TDD 6件）

**Files:**
- Create: `lib/accounting/aggregatePeriod.ts`
- Test: `lib/accounting/__tests__/aggregatePeriod.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/accounting/__tests__/aggregatePeriod.test.ts
import { describe, it, expect } from 'vitest'
import { aggregatePeriod, type JournalLineRow } from '../aggregatePeriod'

function line(p: Partial<JournalLineRow>): JournalLineRow {
  return {
    account_id: p.account_id ?? 'a',
    account_code: p.account_code ?? '101',
    account_name: p.account_name ?? '現金',
    account_category: p.account_category ?? 'asset',
    normal_balance: p.normal_balance ?? 'debit',
    side: p.side ?? 'debit',
    amount: p.amount ?? 0,
    entry_date: p.entry_date ?? '2026-06-15',
  }
}

describe('aggregatePeriod', () => {
  it('sums debit and credit for a single account within period', () => {
    const r = aggregatePeriod([
      line({ side: 'debit', amount: 1000, entry_date: '2026-06-10' }),
      line({ side: 'credit', amount: 300,  entry_date: '2026-06-12' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.accounts).toHaveLength(1)
    expect(r.accounts[0].debitTotal).toBe(1000)
    expect(r.accounts[0].creditTotal).toBe(300)
    expect(r.accounts[0].balance).toBe(700)
  })

  it('excludes P/L lines outside the period', () => {
    const r = aggregatePeriod([
      line({ account_code: '401', account_category: 'revenue', normal_balance: 'credit', side: 'credit', amount: 5000, entry_date: '2026-05-31' }),
      line({ account_code: '401', account_category: 'revenue', normal_balance: 'credit', side: 'credit', amount: 7000, entry_date: '2026-06-15' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.totals.revenue).toBe(7000)
  })

  it('B/S accounts accumulate from beginning (ignore periodStart)', () => {
    const r = aggregatePeriod([
      line({ account_code: '101', account_category: 'asset', normal_balance: 'debit', side: 'debit', amount: 1000, entry_date: '2026-01-15' }),
      line({ account_code: '101', account_category: 'asset', normal_balance: 'debit', side: 'debit', amount: 500,  entry_date: '2026-06-15' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.totals.assets).toBe(1500)
  })

  it('respects normal_balance (credit-side accounts)', () => {
    const r = aggregatePeriod([
      line({ account_code: '211', account_category: 'liability', normal_balance: 'credit', side: 'credit', amount: 2000, entry_date: '2026-06-10' }),
      line({ account_code: '211', account_category: 'liability', normal_balance: 'credit', side: 'debit',  amount: 500,  entry_date: '2026-06-20' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.accounts[0].balance).toBe(1500) // credit - debit
  })

  it('returns empty for empty input', () => {
    const r = aggregatePeriod([], '2026-06-01', '2026-06-30')
    expect(r.accounts).toEqual([])
    expect(r.totals).toEqual({ revenue: 0, expense: 0, netIncome: 0, assets: 0, liabilities: 0, equity: 0 })
  })

  it('excludes accounts with zero balance from result', () => {
    const r = aggregatePeriod([
      line({ account_id: 'A', side: 'debit', amount: 1000, entry_date: '2026-06-10' }),
      line({ account_id: 'A', side: 'credit', amount: 1000, entry_date: '2026-06-12' }),
    ], '2026-06-01', '2026-06-30')
    expect(r.accounts).toEqual([])
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/aggregatePeriod.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/accounting/aggregatePeriod.ts
export interface JournalLineRow {
  account_id: string
  account_code: string
  account_name: string
  account_category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normal_balance: 'debit' | 'credit'
  side: 'debit' | 'credit'
  amount: number
  entry_date: string
}

export interface AccountSummary {
  accountId: string
  code: string
  name: string
  category: JournalLineRow['account_category']
  debitTotal: number
  creditTotal: number
  balance: number
}

export interface AggregateResult {
  accounts: AccountSummary[]
  totals: {
    revenue: number
    expense: number
    netIncome: number
    assets: number
    liabilities: number
    equity: number
  }
}

const PL_CATEGORIES = new Set(['revenue', 'expense'])

export function aggregatePeriod(
  lines: JournalLineRow[],
  periodStart: string,
  periodEnd: string,
): AggregateResult {
  const byAccount = new Map<string, AccountSummary>()
  for (const l of lines) {
    const isPL = PL_CATEGORIES.has(l.account_category)
    if (isPL) {
      if (l.entry_date < periodStart || l.entry_date > periodEnd) continue
    } else {
      if (l.entry_date > periodEnd) continue
    }
    let acc = byAccount.get(l.account_id)
    if (!acc) {
      acc = {
        accountId: l.account_id,
        code: l.account_code,
        name: l.account_name,
        category: l.account_category,
        debitTotal: 0,
        creditTotal: 0,
        balance: 0,
      }
      byAccount.set(l.account_id, acc)
    }
    if (l.side === 'debit') acc.debitTotal += l.amount
    else                    acc.creditTotal += l.amount
  }

  const accounts: AccountSummary[] = []
  let revenue = 0, expense = 0, assets = 0, liabilities = 0, equity = 0
  for (const acc of byAccount.values()) {
    const sample = lines.find(l => l.account_id === acc.accountId)!
    acc.balance = sample.normal_balance === 'debit'
      ? acc.debitTotal - acc.creditTotal
      : acc.creditTotal - acc.debitTotal
    if (acc.balance === 0) continue
    accounts.push(acc)
    if (acc.category === 'revenue')   revenue     += acc.balance
    if (acc.category === 'expense')   expense     += acc.balance
    if (acc.category === 'asset')     assets      += acc.balance
    if (acc.category === 'liability') liabilities += acc.balance
    if (acc.category === 'equity')    equity      += acc.balance
  }
  accounts.sort((a, b) => a.code.localeCompare(b.code))

  return {
    accounts,
    totals: { revenue, expense, netIncome: revenue - expense, assets, liabilities, equity },
  }
}
```

- [ ] **Step 4: PASS（6/6）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/aggregatePeriod.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/aggregatePeriod.ts lib/accounting/__tests__/aggregatePeriod.test.ts && git commit -m "feat(e): aggregatePeriod pure logic for P/L+B/S period aggregation"
```

---

### Task 3: 純粋ロジック `applyTaxMapping`（TDD 5件）

**Files:**
- Create: `lib/accounting/applyTaxMapping.ts`
- Test: `lib/accounting/__tests__/applyTaxMapping.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/accounting/__tests__/applyTaxMapping.test.ts
import { describe, it, expect } from 'vitest'
import { applyTaxMapping } from '../applyTaxMapping'
import type { AccountSummary } from '../aggregatePeriod'

function sum(p: Partial<AccountSummary>): AccountSummary {
  return {
    accountId: p.accountId ?? 'a',
    code: p.code ?? '101',
    name: p.name ?? '現金',
    category: p.category ?? 'asset',
    debitTotal: p.debitTotal ?? 0,
    creditTotal: p.creditTotal ?? 0,
    balance: p.balance ?? 0,
  }
}

describe('applyTaxMapping', () => {
  it('aggregates revenue (401 + 402)', () => {
    const r = applyTaxMapping([
      sum({ code: '401', name: '売上高', category: 'revenue', balance: 5000 }),
      sum({ code: '402', name: '雑収入', category: 'revenue', balance: 1000 }),
    ], 0)
    expect(r.revenue.amount).toBe(6000)
  })

  it('aggregates expense to its tax category', () => {
    const r = applyTaxMapping([
      sum({ code: '512', name: '水道光熱費', category: 'expense', balance: 3000 }),
    ], 0)
    const utility = r.expenses.find(e => e.key === 'utility')
    expect(utility?.amount).toBe(3000)
  })

  it('puts unmapped expense codes into unmapped (not silently in 雑費)', () => {
    const r = applyTaxMapping([
      sum({ code: '999', name: '謎経費', category: 'expense', balance: 500 }),
    ], 0)
    expect(r.unmapped.map(u => u.code)).toContain('999')
  })

  it('matches fixedAssets via codePrefix "15"', () => {
    const r = applyTaxMapping([
      sum({ code: '152', name: '建物', category: 'asset', balance: 100000 }),
      sum({ code: '153', name: '車両運搬具', category: 'asset', balance: 50000 }),
    ], 0)
    const fixed = r.bsAssets.find(a => a.key === 'fixedAssets')
    expect(fixed?.amount).toBe(150000)
  })

  it('places netIncome into bsEquity', () => {
    const r = applyTaxMapping([], 250000)
    const ni = r.bsEquity.find(e => e.key === 'netIncome')
    expect(ni?.amount).toBe(250000)
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/applyTaxMapping.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/accounting/applyTaxMapping.ts
import type { AccountSummary } from './aggregatePeriod'
import {
  PL_REVENUE, PL_PURCHASES, PL_TAX_CATEGORIES, BS_CATEGORIES,
  type BsCategory,
} from './taxMapping'

export interface TaxStyledReport {
  revenue:   { label: string; amount: number; accounts: AccountSummary[] }
  purchases: { label: string; amount: number; accounts: AccountSummary[] }
  expenses:  Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  bsAssets:      Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  bsLiabilities: Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  bsEquity:      Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  unmapped: AccountSummary[]
}

function matchBs(acc: AccountSummary, cat: BsCategory): boolean {
  if (cat.computed) return false
  if (cat.accountCodes && cat.accountCodes.includes(acc.code)) return true
  if (cat.codePrefix && acc.code.startsWith(cat.codePrefix)) return true
  return false
}

export function applyTaxMapping(summary: AccountSummary[], netIncome: number): TaxStyledReport {
  const revenueAccounts:   AccountSummary[] = []
  const purchasesAccounts: AccountSummary[] = []
  const expenseMap = new Map<string, { label: string; amount: number; accounts: AccountSummary[] }>()
  for (const c of PL_TAX_CATEGORIES) expenseMap.set(c.key, { label: c.label, amount: 0, accounts: [] })

  const bsMap = new Map<string, { label: string; section: BsCategory['section']; amount: number; accounts: AccountSummary[] }>()
  for (const c of BS_CATEGORIES) bsMap.set(c.key, { label: c.label, section: c.section, amount: 0, accounts: [] })

  const unmapped: AccountSummary[] = []

  for (const acc of summary) {
    if (acc.category === 'revenue') {
      if (PL_REVENUE.accountCodes.includes(acc.code)) revenueAccounts.push(acc)
      else unmapped.push(acc)
      continue
    }
    if (acc.category === 'expense') {
      if (PL_PURCHASES.accountCodes.includes(acc.code)) { purchasesAccounts.push(acc); continue }
      const cat = PL_TAX_CATEGORIES.find(c => c.accountCodes.includes(acc.code))
      if (cat) {
        const e = expenseMap.get(cat.key)!
        e.amount += acc.balance; e.accounts.push(acc)
      } else {
        unmapped.push(acc)
      }
      continue
    }
    // B/S 系
    const matched = BS_CATEGORIES.find(c => matchBs(acc, c))
    if (matched) {
      const b = bsMap.get(matched.key)!
      b.amount += acc.balance; b.accounts.push(acc)
    } else {
      unmapped.push(acc)
    }
  }

  // netIncome を bsEquity に注入
  const niCat = BS_CATEGORIES.find(c => c.computed === 'netIncome')
  if (niCat) {
    const b = bsMap.get(niCat.key)!
    b.amount = netIncome
  }

  const splitBs = (section: BsCategory['section']) =>
    BS_CATEGORIES
      .filter(c => c.section === section)
      .map(c => {
        const b = bsMap.get(c.key)!
        return { key: c.key, label: b.label, amount: b.amount, accounts: b.accounts }
      })

  return {
    revenue: {
      label: PL_REVENUE.label,
      amount: revenueAccounts.reduce((s, a) => s + a.balance, 0),
      accounts: revenueAccounts,
    },
    purchases: {
      label: PL_PURCHASES.label,
      amount: purchasesAccounts.reduce((s, a) => s + a.balance, 0),
      accounts: purchasesAccounts,
    },
    expenses: PL_TAX_CATEGORIES.map(c => {
      const e = expenseMap.get(c.key)!
      return { key: c.key, label: e.label, amount: e.amount, accounts: e.accounts }
    }),
    bsAssets:      splitBs('asset'),
    bsLiabilities: splitBs('liability'),
    bsEquity:      splitBs('equity'),
    unmapped,
  }
}
```

- [ ] **Step 4: PASS（5/5）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/applyTaxMapping.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/applyTaxMapping.ts lib/accounting/__tests__/applyTaxMapping.test.ts && git commit -m "feat(e): applyTaxMapping pure logic for 青色申告 report formatting"
```

---

### Task 4: 純粋ロジック `yayoiExport`（TDD 4件）

**Files:**
- Create: `lib/accounting/csv/yayoiExport.ts`
- Test: `lib/accounting/__tests__/yayoiExport.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/accounting/__tests__/yayoiExport.test.ts
import { describe, it, expect } from 'vitest'
import { yayoiExport, type JournalForExport } from '../csv/yayoiExport'

const row = (p: Partial<JournalForExport>): JournalForExport => ({
  entryDate: p.entryDate ?? '2026-06-20',
  description: p.description ?? 'テスト摘要',
  debitAccount: p.debitAccount ?? '売掛金',
  debitAmount: p.debitAmount ?? 6000,
  creditAccount: p.creditAccount ?? '売上高',
  creditAmount: p.creditAmount ?? 6000,
})

describe('yayoiExport', () => {
  it('outputs header on first line', () => {
    const csv = yayoiExport([])
    const head = csv.split('\r\n')[0]
    expect(head).toContain('識別フラグ')
    expect(head).toContain('取引日付')
    expect(head).toContain('借方勘定科目')
  })

  it('renders 1 row per journal', () => {
    const csv = yayoiExport([row({})])
    const lines = csv.split('\r\n').filter(l => l.length > 0)
    expect(lines).toHaveLength(2) // header + 1 data
    expect(lines[1]).toContain('"2000"')
    expect(lines[1]).toContain('"2026/06/20"')
    expect(lines[1]).toContain('"売掛金"')
    expect(lines[1]).toContain('"売上高"')
    expect(lines[1]).toContain('6000')
  })

  it('preserves order of input rows', () => {
    const csv = yayoiExport([
      row({ entryDate: '2026-06-10', description: 'A' }),
      row({ entryDate: '2026-06-20', description: 'B' }),
    ])
    const lines = csv.split('\r\n').filter(l => l.length > 0)
    expect(lines[1]).toContain('"A"')
    expect(lines[2]).toContain('"B"')
  })

  it('escapes commas and quotes in description', () => {
    const csv = yayoiExport([row({ description: '備考,"あり"' })])
    expect(csv).toContain('"備考,""あり"""')
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/yayoiExport.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/accounting/csv/yayoiExport.ts
export interface JournalForExport {
  entryDate: string         // YYYY-MM-DD
  description: string
  debitAccount: string
  debitAmount: number
  creditAccount: string
  creditAmount: number
}

const HEADER = [
  '識別フラグ','伝票No','決算','取引日付',
  '借方勘定科目','借方補助科目','借方部門','借方税区分','借方金額','借方税金額','借方摘要',
  '貸方勘定科目','貸方補助科目','貸方部門','貸方税区分','貸方金額','貸方税金額','貸方摘要',
  '摘要','番号','期日','タイプ','生成元','仕訳メモ','付箋1','付箋2',
]

function quote(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

function formatDate(iso: string): string {
  return iso.replace(/-/g, '/')
}

export function yayoiExport(rows: JournalForExport[]): string {
  const lines: string[] = []
  lines.push(HEADER.map(h => quote(h)).join(','))
  for (const r of rows) {
    const cells = [
      quote('2000'), quote(''), quote(''), quote(formatDate(r.entryDate)),
      quote(r.debitAccount), quote(''), quote(''), quote('対象外'), String(r.debitAmount), '0', quote(''),
      quote(r.creditAccount), quote(''), quote(''), quote('対象外'), String(r.creditAmount), '0', quote(''),
      quote(r.description), quote(''), quote(''), quote(''), quote(''), quote(''), quote(''), quote(''),
    ]
    lines.push(cells.join(','))
  }
  return lines.join('\r\n') + '\r\n'
}
```

- [ ] **Step 4: PASS（4/4）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/yayoiExport.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/csv/yayoiExport.ts lib/accounting/__tests__/yayoiExport.test.ts && git commit -m "feat(e): yayoiExport pure logic for 弥生青色申告 CSV"
```

---

### Task 5: 純粋ロジック `freeeExport`（TDD 4件）

**Files:**
- Create: `lib/accounting/csv/freeeExport.ts`
- Test: `lib/accounting/__tests__/freeeExport.test.ts`

- [ ] **Step 1: 失敗するテスト作成**

```typescript
// lib/accounting/__tests__/freeeExport.test.ts
import { describe, it, expect } from 'vitest'
import { freeeExport } from '../csv/freeeExport'
import type { JournalForExport } from '../csv/yayoiExport'

const row = (p: Partial<JournalForExport>): JournalForExport => ({
  entryDate: p.entryDate ?? '2026-06-20',
  description: p.description ?? 'テスト摘要',
  debitAccount: p.debitAccount ?? '売掛金',
  debitAmount: p.debitAmount ?? 6000,
  creditAccount: p.creditAccount ?? '売上高',
  creditAmount: p.creditAmount ?? 6000,
})

describe('freeeExport', () => {
  it('starts with UTF-8 BOM and header', () => {
    const csv = freeeExport([])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    const head = csv.slice(1).split('\r\n')[0]
    expect(head).toContain('日付')
    expect(head).toContain('借方勘定科目')
  })

  it('renders YYYY-MM-DD date format', () => {
    const csv = freeeExport([row({ entryDate: '2026-06-20' })])
    expect(csv).toContain('"2026-06-20"')
  })

  it('preserves order of input rows', () => {
    const csv = freeeExport([
      row({ entryDate: '2026-06-10', description: 'A' }),
      row({ entryDate: '2026-06-20', description: 'B' }),
    ])
    const lines = csv.slice(1).split('\r\n').filter(l => l.length > 0)
    expect(lines[1]).toContain('"A"')
    expect(lines[2]).toContain('"B"')
  })

  it('escapes commas and quotes in description', () => {
    const csv = freeeExport([row({ description: '備考,"あり"' })])
    expect(csv).toContain('"備考,""あり"""')
  })
})
```

- [ ] **Step 2: FAIL 確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/freeeExport.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: 実装**

```typescript
// lib/accounting/csv/freeeExport.ts
import type { JournalForExport } from './yayoiExport'

const HEADER = [
  '日付','取引内容',
  '借方勘定科目','借方税区分','借方金額',
  '貸方勘定科目','貸方税区分','貸方金額',
  '管理番号','品目','部門','メモタグ','セグメント1','備考',
]

function quote(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

export function freeeExport(rows: JournalForExport[]): string {
  const lines: string[] = []
  lines.push(HEADER.map(h => quote(h)).join(','))
  for (const r of rows) {
    const cells = [
      quote(r.entryDate), quote(r.description),
      quote(r.debitAccount), quote('対象外'), String(r.debitAmount),
      quote(r.creditAccount), quote('対象外'), String(r.creditAmount),
      quote(''), quote(''), quote(''), quote(''), quote(''), quote(''),
    ]
    lines.push(cells.join(','))
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}
```

- [ ] **Step 4: PASS（4/4）**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/freeeExport.test.ts 2>&1 | tail -5
```

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/csv/freeeExport.ts lib/accounting/__tests__/freeeExport.test.ts && git commit -m "feat(e): freeeExport pure logic for freee CSV"
```

---

### Task 6: `iconv-lite` インストール

**Files:**
- Modify: `package.json`

- [ ] **Step 1: インストール**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm install iconv-lite 2>&1 | tail -3
```

- [ ] **Step 2: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add package.json package-lock.json && git commit -m "feat(e): install iconv-lite for Shift_JIS encoding"
```

---

### Task 7: API `GET /api/admin/accounting/report`

**Files:**
- Create: `app/api/admin/accounting/report/route.ts`

- [ ] **Step 1: 実装**

```typescript
// app/api/admin/accounting/report/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { aggregatePeriod, type JournalLineRow } from '@/lib/accounting/aggregatePeriod'
import { applyTaxMapping } from '@/lib/accounting/applyTaxMapping'

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = Number(req.nextUrl.searchParams.get('year'))
  const monthRaw = req.nextUrl.searchParams.get('month')
  if (!year || isNaN(year)) return NextResponse.json({ error: 'year required' }, { status: 400 })

  const periodStart = monthRaw
    ? `${year}-${String(Number(monthRaw)).padStart(2, '0')}-01`
    : `${year}-01-01`
  const periodEnd = monthRaw
    ? lastDayOfMonth(year, Number(monthRaw))
    : `${year}-12-31`

  const { data, error } = await supabaseAdmin
    .from('journal_lines')
    .select(`
      side, amount,
      journal_entries!inner(entry_date),
      accounts!inner(id, code, name, category, normal_balance)
    `)
    .lte('journal_entries.entry_date', periodEnd)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lines: JournalLineRow[] = (data ?? []).map((row: Record<string, unknown>) => {
    const e = row.journal_entries as { entry_date: string }
    const a = row.accounts as { id: string; code: string; name: string; category: JournalLineRow['account_category']; normal_balance: 'debit' | 'credit' }
    return {
      account_id: a.id,
      account_code: a.code,
      account_name: a.name,
      account_category: a.category,
      normal_balance: a.normal_balance,
      side: row.side as 'debit' | 'credit',
      amount: row.amount as number,
      entry_date: e.entry_date,
    }
  })

  const agg = aggregatePeriod(lines, periodStart, periodEnd)
  const report = applyTaxMapping(agg.accounts, agg.totals.netIncome)

  return NextResponse.json({
    period: { periodStart, periodEnd, year, month: monthRaw ? Number(monthRaw) : null },
    totals: agg.totals,
    report,
  })
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/api/admin/accounting/report && git commit -m "feat(e): GET /api/admin/accounting/report endpoint"
```

---

### Task 8: API `GET /api/admin/accounting/csv`

**Files:**
- Create: `app/api/admin/accounting/csv/route.ts`

- [ ] **Step 1: 実装**

```typescript
// app/api/admin/accounting/csv/route.ts
import { NextRequest, NextResponse } from 'next/server'
import iconv from 'iconv-lite'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { yayoiExport, type JournalForExport } from '@/lib/accounting/csv/yayoiExport'
import { freeeExport } from '@/lib/accounting/csv/freeeExport'

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const format = req.nextUrl.searchParams.get('format')
  const year = Number(req.nextUrl.searchParams.get('year'))
  const monthRaw = req.nextUrl.searchParams.get('month')
  if (!year || isNaN(year) || (format !== 'yayoi' && format !== 'freee'))
    return new NextResponse('Bad Request', { status: 400 })

  const periodStart = monthRaw
    ? `${year}-${String(Number(monthRaw)).padStart(2, '0')}-01`
    : `${year}-01-01`
  const periodEnd = monthRaw
    ? lastDayOfMonth(year, Number(monthRaw))
    : `${year}-12-31`

  // entries + lines を取り、振替伝票形式（借方1+貸方1 のシンプル仕訳）に変換
  const { data: entries, error } = await supabaseAdmin
    .from('journal_entries')
    .select(`
      id, entry_date, description,
      journal_lines(side, amount, accounts(name))
    `)
    .gte('entry_date', periodStart)
    .lte('entry_date', periodEnd)
    .order('entry_date', { ascending: true })
  if (error) return new NextResponse(`Error: ${error.message}`, { status: 500 })

  const rows: JournalForExport[] = []
  for (const e of entries ?? []) {
    const lines = (e as unknown as { journal_lines: { side: 'debit'|'credit'; amount: number; accounts: { name: string } }[] }).journal_lines
    const debit = lines.find(l => l.side === 'debit')
    const credit = lines.find(l => l.side === 'credit')
    if (!debit || !credit) continue   // 複合仕訳は省略（YAGNI: 出てきたら拡張）
    rows.push({
      entryDate: (e as { entry_date: string }).entry_date,
      description: (e as { description: string }).description,
      debitAccount: debit.accounts.name,
      debitAmount: debit.amount,
      creditAccount: credit.accounts.name,
      creditAmount: credit.amount,
    })
  }

  const suffix = monthRaw ? `_${year}_${String(Number(monthRaw)).padStart(2, '0')}` : `_${year}`

  if (format === 'yayoi') {
    const csv = yayoiExport(rows)
    const buf = iconv.encode(csv, 'Shift_JIS')
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'text/csv; charset=shift_jis',
        'Content-Disposition': `attachment; filename="yayoi${suffix}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  const csv = freeeExport(rows)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="freee${suffix}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/api/admin/accounting/csv && git commit -m "feat(e): GET /api/admin/accounting/csv endpoint (yayoi/freee)"
```

---

### Task 9: 期間切替バー `PeriodSelector`（Client Component）

**Files:**
- Create: `app/admin/(dashboard)/accounting/report/PeriodSelector.tsx`

- [ ] **Step 1: 実装**

```tsx
// app/admin/(dashboard)/accounting/report/PeriodSelector.tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]

export default function PeriodSelector({ availableYears }: { availableYears: number[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const year = Number(params.get('year') ?? new Date().getFullYear())
  const month = params.get('month') ? Number(params.get('month')) : null

  const update = (next: { year?: number; month?: number | null }) => {
    const sp = new URLSearchParams(params.toString())
    if (next.year !== undefined) sp.set('year', String(next.year))
    if (next.month === null) sp.delete('month')
    else if (next.month !== undefined) sp.set('month', String(next.month))
    router.push(`?${sp.toString()}`)
  }

  const csvHref = (format: 'yayoi' | 'freee') => {
    const sp = new URLSearchParams()
    sp.set('format', format); sp.set('year', String(year))
    if (month) sp.set('month', String(month))
    return `/api/admin/accounting/csv?${sp.toString()}`
  }

  return (
    <div className="sticky top-0 z-10 bg-warm-50 border-b border-warm-100 py-3 mb-4 flex flex-wrap gap-2 items-center">
      <label className="text-sm text-warm-500">年度
        <select value={year} onChange={e => update({ year: Number(e.target.value) })}
          className="ml-2 border border-warm-200 rounded px-2 py-1">
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label className="text-sm text-warm-500 inline-flex items-center gap-2">
        <input type="radio" checked={month !== null} onChange={() => update({ month: new Date().getMonth() + 1 })} /> 月次
      </label>
      <label className="text-sm text-warm-500 inline-flex items-center gap-2">
        <input type="radio" checked={month === null} onChange={() => update({ month: null })} /> 年次
      </label>
      {month !== null && (
        <label className="text-sm text-warm-500">月
          <select value={month} onChange={e => update({ month: Number(e.target.value) })}
            className="ml-2 border border-warm-200 rounded px-2 py-1">
            {MONTHS.map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
        </label>
      )}
      <div className="ml-auto flex gap-2">
        <a href={csvHref('yayoi')} className="bg-warm-500 hover:bg-warm-600 text-white text-sm px-3 py-1.5 rounded">📥 弥生CSV</a>
        <a href={csvHref('freee')} className="bg-warm-500 hover:bg-warm-600 text-white text-sm px-3 py-1.5 rounded">📥 freee CSV</a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/admin/(dashboard)/accounting/report/PeriodSelector.tsx" && git commit -m "feat(e): PeriodSelector for /admin/accounting/report"
```

---

### Task 10: 決算書ページ `/admin/accounting/report`

**Files:**
- Create: `app/admin/(dashboard)/accounting/report/page.tsx`

- [ ] **Step 1: 実装**

```tsx
// app/admin/(dashboard)/accounting/report/page.tsx
import { supabaseAdmin } from '@/lib/supabase'
import { aggregatePeriod, type JournalLineRow } from '@/lib/accounting/aggregatePeriod'
import { applyTaxMapping } from '@/lib/accounting/applyTaxMapping'
import PeriodSelector from './PeriodSelector'

export const dynamic = 'force-dynamic'

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

const yen = (n: number) => `¥${n.toLocaleString()}`

interface SP { year?: string; month?: string }

export default async function ReportPage({ searchParams }: { searchParams: SP }) {
  const now = new Date()
  const year = Number(searchParams.year ?? now.getFullYear())
  const month = searchParams.month ? Number(searchParams.month) : null
  const periodStart = month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`
  const periodEnd   = month ? lastDayOfMonth(year, month) : `${year}-12-31`

  const { data } = await supabaseAdmin
    .from('journal_lines')
    .select(`
      side, amount,
      journal_entries!inner(entry_date),
      accounts!inner(id, code, name, category, normal_balance)
    `)
    .lte('journal_entries.entry_date', periodEnd)

  const lines: JournalLineRow[] = (data ?? []).map((row: Record<string, unknown>) => {
    const e = row.journal_entries as { entry_date: string }
    const a = row.accounts as { id: string; code: string; name: string; category: JournalLineRow['account_category']; normal_balance: 'debit' | 'credit' }
    return {
      account_id: a.id, account_code: a.code, account_name: a.name,
      account_category: a.category, normal_balance: a.normal_balance,
      side: row.side as 'debit' | 'credit', amount: row.amount as number, entry_date: e.entry_date,
    }
  })

  const agg = aggregatePeriod(lines, periodStart, periodEnd)
  const report = applyTaxMapping(agg.accounts, agg.totals.netIncome)

  const periodLabel = month ? `${year}年${month}月` : `${year}年`
  const periodEndLabel = month ? `${year}年${month}月末時点` : `${year}年12月末時点`

  const assetsTotal      = report.bsAssets.reduce((s, r) => s + r.amount, 0)
  const liabilitiesTotal = report.bsLiabilities.reduce((s, r) => s + r.amount, 0)
  const equityTotal      = report.bsEquity.reduce((s, r) => s + r.amount, 0)
  const bsImbalance      = assetsTotal !== liabilitiesTotal + equityTotal

  const availableYears = (() => {
    const y = now.getFullYear()
    return [y - 4, y - 3, y - 2, y - 1, y, y + 1]
  })()

  const hasData = lines.length > 0

  return (
    <main className="min-h-screen bg-warm-50 p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-warm-700 font-serif text-2xl mb-2">📊 決算書</h1>
        <PeriodSelector availableYears={availableYears} />

        {report.unmapped.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 text-sm text-warm-700">
            ⚠ 未分類の科目: {report.unmapped.map(u => `${u.name}(${u.code})`).join(', ')}
          </div>
        )}

        {!hasData ? (
          <p className="text-warm-400 text-sm py-10 text-center">対象期間に取引がありません</p>
        ) : (
          <>
            <section className="bg-white border border-warm-100 rounded-2xl p-5 mb-5">
              <h2 className="font-bold text-warm-700 mb-3">損益計算書（{periodLabel}）</h2>
              <div className="flex justify-between py-1">
                <span>{report.revenue.label}</span>
                <span className="font-bold">{yen(report.revenue.amount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>{report.purchases.label}</span>
                <span className="font-bold">−{yen(report.purchases.amount)}</span>
              </div>
              <hr className="my-2 border-warm-100" />
              <div className="flex justify-between py-1 font-bold text-warm-700">
                <span>差引金額</span>
                <span>{yen(report.revenue.amount - report.purchases.amount)}</span>
              </div>

              <h3 className="mt-4 mb-2 text-warm-500 text-sm font-bold">経費</h3>
              {report.expenses.filter(e => e.amount !== 0).map(e => (
                <div key={e.key} className="flex justify-between py-0.5 pl-2 text-sm">
                  <span>{e.label}</span>
                  <span>{yen(e.amount)}</span>
                </div>
              ))}
              <hr className="my-2 border-warm-100" />
              <div className="flex justify-between py-1 font-bold">
                <span>経費計</span>
                <span>{yen(report.expenses.reduce((s, e) => s + e.amount, 0))}</span>
              </div>
              <div className="flex justify-between py-2 mt-3 text-warm-700 font-bold text-lg border-t border-warm-300">
                <span>所得金額</span>
                <span>{yen(agg.totals.netIncome)}</span>
              </div>
            </section>

            <section className="bg-white border border-warm-100 rounded-2xl p-5">
              <h2 className="font-bold text-warm-700 mb-3">貸借対照表（{periodEndLabel}）</h2>
              {bsImbalance && (
                <p className="text-red-500 text-sm mb-2">⚠ 借方 ≠ 貸方（仕訳に不整合の可能性）</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-warm-500 text-sm font-bold mb-2">資産の部</h3>
                  {report.bsAssets.filter(r => r.amount !== 0).map(r => (
                    <div key={r.key} className="flex justify-between py-0.5 pl-2 text-sm">
                      <span>{r.label}</span>
                      <span>{yen(r.amount)}</span>
                    </div>
                  ))}
                  <hr className="my-2 border-warm-100" />
                  <div className="flex justify-between py-1 font-bold">
                    <span>資産計</span>
                    <span>{yen(assetsTotal)}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-warm-500 text-sm font-bold mb-2">負債の部</h3>
                  {report.bsLiabilities.filter(r => r.amount !== 0).map(r => (
                    <div key={r.key} className="flex justify-between py-0.5 pl-2 text-sm">
                      <span>{r.label}</span>
                      <span>{yen(r.amount)}</span>
                    </div>
                  ))}
                  <hr className="my-2 border-warm-100" />
                  <div className="flex justify-between py-1 font-bold">
                    <span>負債計</span>
                    <span>{yen(liabilitiesTotal)}</span>
                  </div>

                  <h3 className="text-warm-500 text-sm font-bold mt-4 mb-2">資本の部</h3>
                  {report.bsEquity.filter(r => r.amount !== 0).map(r => (
                    <div key={r.key} className="flex justify-between py-0.5 pl-2 text-sm">
                      <span>{r.label}</span>
                      <span>{yen(r.amount)}</span>
                    </div>
                  ))}
                  <hr className="my-2 border-warm-100" />
                  <div className="flex justify-between py-1 font-bold">
                    <span>資本計</span>
                    <span>{yen(equityTotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 mt-2 font-bold text-warm-700 border-t border-warm-300">
                    <span>負債・資本計</span>
                    <span>{yen(liabilitiesTotal + equityTotal)}</span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/admin/(dashboard)/accounting/report/page.tsx" && git commit -m "feat(e): /admin/accounting/report page (P/L + B/S)"
```

---

### Task 11: サイドバーに「📊 決算書」リンク追加

**Files:**
- Modify: `app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: 修正**

`{ href: '/admin/accounting', label: '🧮 会計' },` の次の行に追加:

```tsx
            { href: '/admin/accounting/report', label: '📊 決算書' },
```

実行:

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && head -50 "app/admin/(dashboard)/layout.tsx"
```
で位置確認の上、Edit で挿入。

- [ ] **Step 2: 型チェック・コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/admin/(dashboard)/layout.tsx" && git commit -m "feat(e): add 決算書 link to admin sidebar"
```

---

### Task 12: 全テスト・ビルド・デプロイ・手動疎通

**Files:** なし（インフラ作業）

- [ ] **Step 1: 全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -3
```
Expected: **240 PASS**（221 既存 + 19 新規）

- [ ] **Step 2: 型チェック**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -10
```
Expected: 新規エラーなし

- [ ] **Step 3: 本番ビルド**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | grep -E "/admin/accounting/report|/api/admin/accounting/(report|csv)"
```
Expected:
```
├ ƒ /admin/accounting/report
├ ƒ /api/admin/accounting/report
├ ƒ /api/admin/accounting/csv
```

- [ ] **Step 4: main merge + push + デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git checkout main && git merge --ff-only feat/e-financial-statements && git push origin main 2>&1 | tail -3
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vercel --prod 2>&1 | tail -4
```

- [ ] **Step 5: 手動疎通**

ユーザーに以下の確認を依頼:

1. `/admin/accounting/report?year=2026&month=6` を開く → P/L・B/S 表示
2. 年度プルダウン・月次↔年次ラジオ・月プルダウンが動作
3. データのない期間で「対象期間に取引がありません」表示
4. 未マッピング科目があれば上部に警告バナー
5. 「📥 弥生CSV」DL → Excel で開いて文字化け無し（Shift_JIS）
6. 「📥 freee CSV」DL → freee に取り込みテスト
7. 借方≠貸方の場合、B/S に赤字警告

---

## 完了基準

- 全 240 テスト pass
- 本番ビルド成功、新規 3 ルート登録
- Vercel デプロイ Ready
- 手動疎通 7 項目すべて成功
- ブランチ `feat/e-financial-statements` を main に merge 済

完了後、@blueSky の青色申告は弥生 / freee 取り込み経由で電子申告まで完結。次フェーズ候補: B-6（Stripe）/ 比較表示機能 / e-Tax XBRL 直接生成。
