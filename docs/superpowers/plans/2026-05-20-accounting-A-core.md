# 会計サブプロジェクトA：複式簿記コア 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手入力で複式簿記がつけられ、総勘定元帳・試算表を出せる会計コアを @blueSky 予約サイトに追加する。

**Architecture:** 純粋ロジック（`lib/accounting/`）を TDD で先に固め、その上に Supabase テーブル（4つ）・admin認証付きAPI・管理画面6つを乗せる。会計の整合性（借貸一致）は純粋関数＋ユニットテストで保証する。

**Tech Stack:** Next.js 14 App Router, Supabase (supabaseAdmin + RLS), TypeScript, Vitest, TailwindCSS warm palette。

**参照スペック:** `docs/superpowers/specs/2026-05-20-accounting-A-core-design.md`

---

## File Structure

| ファイル | 責務 |
|---------|------|
| `lib/accounting/types.ts` | 型定義（Account, Side, JournalEntryInput 等）|
| `lib/accounting/validateEntry.ts` | 仕訳の借貸一致検証 |
| `lib/accounting/trialBalance.ts` | 試算表の集計 |
| `lib/accounting/ledger.ts` | 総勘定元帳の残高累計 |
| `lib/accounting/accountRules.ts` | 科目削除可否判定 |
| `lib/accounting/__tests__/*.test.ts` | ユニットテスト |
| `supabase/migrations/008_accounting_core.sql` | 4テーブル＋RLS＋科目seed |
| `app/api/admin/accounting/accounts/route.ts` | 科目 GET/POST |
| `app/api/admin/accounting/accounts/[id]/route.ts` | 科目 PATCH/DELETE |
| `app/api/admin/accounting/entries/route.ts` | 仕訳 GET/POST |
| `app/api/admin/accounting/entries/[id]/route.ts` | 仕訳 GET/PATCH/DELETE |
| `app/api/admin/accounting/opening-balances/route.ts` | 期首残高 GET/POST |
| `components/admin/accounting/JournalEntryForm.tsx` | 仕訳入力フォーム（クライアント）|
| `components/admin/accounting/AccountManager.tsx` | 科目マスタ管理（クライアント）|
| `app/admin/(dashboard)/accounting/page.tsx` | 会計トップ |
| `app/admin/(dashboard)/accounting/journal/page.tsx` | 仕訳帳 |
| `app/admin/(dashboard)/accounting/ledger/page.tsx` | 総勘定元帳 |
| `app/admin/(dashboard)/accounting/trial-balance/page.tsx` | 試算表 |
| `app/admin/(dashboard)/accounting/accounts/page.tsx` | 科目マスタ |
| `app/admin/(dashboard)/accounting/opening/page.tsx` | 期首残高 |
| `app/admin/(dashboard)/layout.tsx` | ナビに「🧮 会計」追加（修正）|

---

## 前提知識（実装者向け）

- **admin API の既存パターン**: `createSupabaseServerClient()` で `auth.getSession()` を取り、無ければ 401。DML は `supabaseAdmin`（`@/lib/supabase`）を使う。例は `app/api/admin/faqs/route.ts` 参照。
- **admin ページの既存パターン**: `app/admin/(dashboard)/reviews/page.tsx` が Server Component で `supabaseAdmin` から取得し、クライアント管理コンポーネントに渡す形。`(dashboard)` 配下は認証済み（未ログインはログインへリダイレクト）。
- **テスト**: Vitest。`npx vitest run <path>` で個別実行。
- **シェル**: Bash ツール（Git Bash）。PowerShell 禁止。パスは `C:/Users/biscu/Downloads/bluesky-camp`。
- **金額は整数（円）**。小数なし。

---

### Task 1: 型定義と仕訳検証 `validateEntry`

**Files:**
- Create: `lib/accounting/types.ts`
- Create: `lib/accounting/validateEntry.ts`
- Test: `lib/accounting/__tests__/validateEntry.test.ts`

- [ ] **Step 1: 型定義を作成 `lib/accounting/types.ts`**

```typescript
export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type Side = 'debit' | 'credit'

export interface Account {
  id: string
  code: string
  name: string
  category: AccountCategory
  normalBalance: Side
  isActive: boolean
  sortOrder: number
}

export interface JournalLineInput {
  accountId: string
  side: Side
  amount: number
}

export interface JournalEntryInput {
  entryDate: string
  description: string
  lines: JournalLineInput[]
}

export interface OpeningBalance {
  accountId: string
  side: Side
  amount: number
}
```

- [ ] **Step 2: 失敗するテストを作成 `lib/accounting/__tests__/validateEntry.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { validateEntry } from '../validateEntry'
import type { JournalEntryInput } from '../types'

const base = (lines: JournalEntryInput['lines']): JournalEntryInput => ({
  entryDate: '2026-01-15', description: 'test', lines,
})

describe('validateEntry', () => {
  it('returns null for a balanced entry', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit',  amount: 10000 },
      { accountId: 'b', side: 'credit', amount: 10000 },
    ]))).toBeNull()
  })

  it('rejects fewer than 2 lines', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit', amount: 10000 },
    ]))).toBe('明細は2件以上必要です')
  })

  it('rejects non-positive amount', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit',  amount: 0 },
      { accountId: 'b', side: 'credit', amount: 0 },
    ]))).toBe('金額は正の整数で入力してください')
  })

  it('rejects non-integer amount', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit',  amount: 100.5 },
      { accountId: 'b', side: 'credit', amount: 100.5 },
    ]))).toBe('金額は正の整数で入力してください')
  })

  it('rejects invalid side', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'foo' as never, amount: 100 },
      { accountId: 'b', side: 'credit',       amount: 100 },
    ]))).toBe('借方・貸方の指定が不正です')
  })

  it('rejects unbalanced entry with a message showing totals', () => {
    expect(validateEntry(base([
      { accountId: 'a', side: 'debit',  amount: 10000 },
      { accountId: 'b', side: 'credit', amount: 9000 },
    ]))).toBe('借方と貸方の合計が一致しません（借方 ¥10,000 / 貸方 ¥9,000）')
  })
})
```

- [ ] **Step 3: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/validateEntry.test.ts 2>&1 | tail -10`
Expected: FAIL（validateEntry が無い）

- [ ] **Step 4: 実装 `lib/accounting/validateEntry.ts`**

```typescript
import type { JournalEntryInput } from './types'

export function validateEntry(entry: JournalEntryInput): string | null {
  const { lines } = entry
  if (!lines || lines.length < 2) {
    return '明細は2件以上必要です'
  }
  for (const line of lines) {
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      return '金額は正の整数で入力してください'
    }
    if (line.side !== 'debit' && line.side !== 'credit') {
      return '借方・貸方の指定が不正です'
    }
  }
  const debit  = lines.filter(l => l.side === 'debit').reduce((s, l) => s + l.amount, 0)
  const credit = lines.filter(l => l.side === 'credit').reduce((s, l) => s + l.amount, 0)
  if (debit !== credit) {
    return `借方と貸方の合計が一致しません（借方 ¥${debit.toLocaleString()} / 貸方 ¥${credit.toLocaleString()}）`
  }
  return null
}
```

- [ ] **Step 5: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/validateEntry.test.ts 2>&1 | tail -10`
Expected: 6 passed

- [ ] **Step 6: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/types.ts lib/accounting/validateEntry.ts lib/accounting/__tests__/validateEntry.test.ts && git commit -m "feat(accounting): journal entry validation + types"
```

---

### Task 2: 試算表の集計 `computeTrialBalance`

**Files:**
- Create: `lib/accounting/trialBalance.ts`
- Test: `lib/accounting/__tests__/trialBalance.test.ts`

このタスクで使う追加型は `trialBalance.ts` 内に定義する（types.ts には入れない）。仕訳は集計用に「フラットな明細リスト」を受け取る形にする。

- [ ] **Step 1: 失敗するテストを作成 `lib/accounting/__tests__/trialBalance.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { computeTrialBalance } from '../trialBalance'
import type { Account, OpeningBalance } from '../types'
import type { PostedLine } from '../trialBalance'

const acc = (id: string, category: Account['category'], normalBalance: Account['normalBalance']): Account => ({
  id, code: id, name: id, category, normalBalance, isActive: true, sortOrder: 0,
})

const cash    = acc('cash',  'asset',   'debit')
const sales   = acc('sales', 'revenue', 'credit')
const expense = acc('exp',   'expense', 'debit')

describe('computeTrialBalance', () => {
  it('sums debit/credit and computes normal-side balance', () => {
    const lines: PostedLine[] = [
      { accountId: 'cash',  side: 'debit',  amount: 10000 },
      { accountId: 'sales', side: 'credit', amount: 10000 },
    ]
    const result = computeTrialBalance([cash, sales], lines, [])
    const cashRow  = result.rows.find(r => r.account.id === 'cash')!
    const salesRow = result.rows.find(r => r.account.id === 'sales')!
    expect(cashRow.debitTotal).toBe(10000)
    expect(cashRow.balance).toBe(10000)      // asset: debit-credit
    expect(salesRow.creditTotal).toBe(10000)
    expect(salesRow.balance).toBe(10000)     // revenue: credit-debit
    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(10000)
    expect(result.totalCredit).toBe(10000)
  })

  it('includes opening balances', () => {
    const opening: OpeningBalance[] = [{ accountId: 'cash', side: 'debit', amount: 5000 }]
    const result = computeTrialBalance([cash], [], opening)
    const cashRow = result.rows.find(r => r.account.id === 'cash')!
    expect(cashRow.debitTotal).toBe(5000)
    expect(cashRow.balance).toBe(5000)
  })

  it('flags unbalanced totals', () => {
    const lines: PostedLine[] = [
      { accountId: 'cash', side: 'debit',  amount: 10000 },
      { accountId: 'exp',  side: 'debit',  amount: 5000 },
    ]
    const result = computeTrialBalance([cash, expense], lines, [])
    expect(result.balanced).toBe(false)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/trialBalance.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: 実装 `lib/accounting/trialBalance.ts`**

```typescript
import type { Account, OpeningBalance, Side } from './types'

export interface PostedLine {
  accountId: string
  side: Side
  amount: number
}

export interface TrialBalanceRow {
  account: Account
  debitTotal: number
  creditTotal: number
  balance: number   // normalBalance 側を正とした期末残高
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
}

export function computeTrialBalance(
  accounts: Account[],
  lines: PostedLine[],
  openingBalances: OpeningBalance[],
): TrialBalanceResult {
  const debitByAccount  = new Map<string, number>()
  const creditByAccount = new Map<string, number>()

  const add = (map: Map<string, number>, id: string, amount: number) =>
    map.set(id, (map.get(id) ?? 0) + amount)

  for (const ob of openingBalances) {
    if (ob.side === 'debit') add(debitByAccount, ob.accountId, ob.amount)
    else                     add(creditByAccount, ob.accountId, ob.amount)
  }
  for (const line of lines) {
    if (line.side === 'debit') add(debitByAccount, line.accountId, line.amount)
    else                       add(creditByAccount, line.accountId, line.amount)
  }

  const rows: TrialBalanceRow[] = accounts.map(account => {
    const debitTotal  = debitByAccount.get(account.id) ?? 0
    const creditTotal = creditByAccount.get(account.id) ?? 0
    const balance = account.normalBalance === 'debit'
      ? debitTotal - creditTotal
      : creditTotal - debitTotal
    return { account, debitTotal, creditTotal, balance }
  })

  const totalDebit  = rows.reduce((s, r) => s + r.debitTotal, 0)
  const totalCredit = rows.reduce((s, r) => s + r.creditTotal, 0)

  return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit }
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/trialBalance.test.ts 2>&1 | tail -10`
Expected: 3 passed

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/trialBalance.ts lib/accounting/__tests__/trialBalance.test.ts && git commit -m "feat(accounting): trial balance computation"
```

---

### Task 3: 総勘定元帳 `computeLedger`

**Files:**
- Create: `lib/accounting/ledger.ts`
- Test: `lib/accounting/__tests__/ledger.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/accounting/__tests__/ledger.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { computeLedger } from '../ledger'
import type { Account } from '../types'
import type { PostedEntry } from '../ledger'

const acc = (id: string, normalBalance: Account['normalBalance']): Account => ({
  id, code: id, name: id, category: normalBalance === 'debit' ? 'asset' : 'liability',
  normalBalance, isActive: true, sortOrder: 0,
})

const cash    = acc('cash', 'debit')
const payable = acc('pay',  'credit')

describe('computeLedger', () => {
  it('accumulates running balance for a debit-normal account', () => {
    const entries: PostedEntry[] = [
      { date: '2026-01-10', description: 'sale', lines: [
        { accountId: 'cash', side: 'debit',  amount: 10000, accountName: 'cash' },
        { accountId: 'sal',  side: 'credit', amount: 10000, accountName: 'sales' },
      ]},
      { date: '2026-01-12', description: 'buy', lines: [
        { accountId: 'exp',  side: 'debit',  amount: 3000, accountName: 'exp' },
        { accountId: 'cash', side: 'credit', amount: 3000, accountName: 'cash' },
      ]},
    ]
    const rows = computeLedger('cash', cash, entries, 0)
    expect(rows).toHaveLength(2)
    expect(rows[0].debit).toBe(10000)
    expect(rows[0].balance).toBe(10000)
    expect(rows[0].counterAccountName).toBe('sales')
    expect(rows[1].credit).toBe(3000)
    expect(rows[1].balance).toBe(7000)       // 10000 - 3000
  })

  it('uses 諸口 for compound entries (3+ lines)', () => {
    const entries: PostedEntry[] = [
      { date: '2026-02-01', description: 'split', lines: [
        { accountId: 'cash', side: 'debit',  amount: 5000, accountName: 'cash' },
        { accountId: 'a',    side: 'credit', amount: 3000, accountName: 'A' },
        { accountId: 'b',    side: 'credit', amount: 2000, accountName: 'B' },
      ]},
    ]
    const rows = computeLedger('cash', cash, entries, 0)
    expect(rows[0].counterAccountName).toBe('諸口')
  })

  it('credit-normal account increases on credit', () => {
    const entries: PostedEntry[] = [
      { date: '2026-01-05', description: 'borrow', lines: [
        { accountId: 'cash', side: 'debit',  amount: 8000, accountName: 'cash' },
        { accountId: 'pay',  side: 'credit', amount: 8000, accountName: 'payable' },
      ]},
    ]
    const rows = computeLedger('pay', payable, entries, 0)
    expect(rows[0].balance).toBe(8000)       // liability: credit increases
  })

  it('starts from opening balance', () => {
    const rows = computeLedger('cash', cash, [], 5000)
    expect(rows).toHaveLength(0)             // no entry rows, opening handled by caller display
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/ledger.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: 実装 `lib/accounting/ledger.ts`**

```typescript
import type { Account, Side } from './types'

export interface PostedEntryLine {
  accountId: string
  side: Side
  amount: number
  accountName: string
}

export interface PostedEntry {
  date: string
  description: string
  lines: PostedEntryLine[]
}

export interface LedgerRow {
  date: string
  entryDescription: string
  counterAccountName: string | null
  debit: number
  credit: number
  balance: number
}

export function computeLedger(
  accountId: string,
  account: Account,
  entries: PostedEntry[],
  openingBalance: number,
): LedgerRow[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  let balance = openingBalance
  const rows: LedgerRow[] = []

  for (const entry of sorted) {
    for (const line of entry.lines) {
      if (line.accountId !== accountId) continue

      const others = entry.lines.filter(l => l.accountId !== accountId)
      const counterAccountName = others.length === 1 ? others[0].accountName : '諸口'

      const debit  = line.side === 'debit'  ? line.amount : 0
      const credit = line.side === 'credit' ? line.amount : 0

      if (account.normalBalance === 'debit') balance += debit - credit
      else                                   balance += credit - debit

      rows.push({
        date: entry.date,
        entryDescription: entry.description,
        counterAccountName,
        debit, credit, balance,
      })
    }
  }
  return rows
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/ledger.test.ts 2>&1 | tail -10`
Expected: 4 passed

- [ ] **Step 5: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/accounting/ledger.ts lib/accounting/__tests__/ledger.test.ts && git commit -m "feat(accounting): general ledger computation"
```

---

### Task 4: 科目削除可否 `canDeleteAccount`

**Files:**
- Create: `lib/accounting/accountRules.ts`
- Test: `lib/accounting/__tests__/accountRules.test.ts`

- [ ] **Step 1: 失敗するテストを作成 `lib/accounting/__tests__/accountRules.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { canDeleteAccount } from '../accountRules'

describe('canDeleteAccount', () => {
  it('allows deletion when account has no usage', () => {
    expect(canDeleteAccount('cash', ['sales', 'exp'])).toBe(true)
  })
  it('forbids deletion when account is used in a line', () => {
    expect(canDeleteAccount('cash', ['cash', 'sales'])).toBe(false)
  })
  it('allows deletion for empty usage list', () => {
    expect(canDeleteAccount('cash', [])).toBe(true)
  })
})
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/accountRules.test.ts 2>&1 | tail -10`
Expected: FAIL

- [ ] **Step 3: 実装 `lib/accounting/accountRules.ts`**

```typescript
/** 仕訳明細で使われている account_id の一覧を受け取り、削除可能かを返す */
export function canDeleteAccount(accountId: string, usedAccountIds: string[]): boolean {
  return !usedAccountIds.includes(accountId)
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run lib/accounting/__tests__/accountRules.test.ts 2>&1 | tail -10`
Expected: 3 passed

- [ ] **Step 5: 全テスト確認＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5 && git add lib/accounting/accountRules.ts lib/accounting/__tests__/accountRules.test.ts && git commit -m "feat(accounting): account deletion rule"
```
Expected: 全テスト pass（既存77 + 新規16 = 93）

---

### Task 5: SQL マイグレーション（4テーブル＋RLS＋科目seed）

**Files:**
- Create: `supabase/migrations/008_accounting_core.sql`

- [ ] **Step 1: マイグレーションファイルを作成 `supabase/migrations/008_accounting_core.sql`**

```sql
-- supabase/migrations/008_accounting_core.sql

-- ① 勘定科目マスタ
CREATE TABLE accounts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text        NOT NULL UNIQUE,
  name           text        NOT NULL,
  category       text        NOT NULL,
  normal_balance text        NOT NULL,
  is_active      boolean     NOT NULL DEFAULT true,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_accounts_category ON accounts (category);
CREATE INDEX idx_accounts_active   ON accounts (is_active);

-- ② 仕訳ヘッダ
CREATE TABLE journal_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  date        NOT NULL,
  description text        NOT NULL DEFAULT '',
  source      text        NOT NULL DEFAULT 'manual',
  source_id   text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_journal_entries_date   ON journal_entries (entry_date);
CREATE INDEX idx_journal_entries_source ON journal_entries (source, source_id);

-- ③ 仕訳明細
CREATE TABLE journal_lines (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid    NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       uuid    NOT NULL REFERENCES accounts(id),
  side             text    NOT NULL,
  amount           integer NOT NULL CHECK (amount > 0),
  tax_category     text,
  line_order       integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_journal_lines_entry   ON journal_lines (journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines (account_id);

-- ④ 期首残高
CREATE TABLE opening_balances (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year  integer NOT NULL,
  account_id   uuid    NOT NULL REFERENCES accounts(id),
  side         text    NOT NULL,
  amount       integer NOT NULL CHECK (amount >= 0),
  UNIQUE (fiscal_year, account_id)
);
CREATE INDEX idx_opening_balances_year ON opening_balances (fiscal_year);

-- RLS（公開読み取りなし。アクセスは service role 経由のみ）
ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_balances ENABLE ROW LEVEL SECURITY;

-- 初期勘定科目（青色申告決算書 一般用に準拠）
INSERT INTO accounts (code, name, category, normal_balance, sort_order) VALUES
  ('101', '現金',         'asset',     'debit',  10),
  ('102', '普通預金',     'asset',     'debit',  20),
  ('103', '売掛金',       'asset',     'debit',  30),
  ('104', '前払金',       'asset',     'debit',  40),
  ('151', '工具器具備品', 'asset',     'debit',  50),
  ('152', '建物',         'asset',     'debit',  60),
  ('153', '車両運搬具',   'asset',     'debit',  70),
  ('201', '買掛金',       'liability', 'credit', 110),
  ('202', '未払金',       'liability', 'credit', 120),
  ('203', '前受金',       'liability', 'credit', 130),
  ('204', '預り金',       'liability', 'credit', 140),
  ('211', '借入金',       'liability', 'credit', 150),
  ('301', '元入金',       'equity',    'credit', 210),
  ('302', '事業主貸',     'equity',    'debit',  220),
  ('303', '事業主借',     'equity',    'credit', 230),
  ('401', '売上高',       'revenue',   'credit', 310),
  ('402', '雑収入',       'revenue',   'credit', 320),
  ('501', '仕入高',       'expense',   'debit',  410),
  ('511', '租税公課',     'expense',   'debit',  420),
  ('512', '水道光熱費',   'expense',   'debit',  430),
  ('513', '旅費交通費',   'expense',   'debit',  440),
  ('514', '通信費',       'expense',   'debit',  450),
  ('515', '広告宣伝費',   'expense',   'debit',  460),
  ('516', '接待交際費',   'expense',   'debit',  470),
  ('517', '損害保険料',   'expense',   'debit',  480),
  ('518', '修繕費',       'expense',   'debit',  490),
  ('519', '消耗品費',     'expense',   'debit',  500),
  ('520', '減価償却費',   'expense',   'debit',  510),
  ('521', '福利厚生費',   'expense',   'debit',  520),
  ('522', '給料賃金',     'expense',   'debit',  530),
  ('523', '外注工賃',     'expense',   'debit',  540),
  ('524', '利子割引料',   'expense',   'debit',  550),
  ('525', '地代家賃',     'expense',   'debit',  560),
  ('526', '支払手数料',   'expense',   'debit',  570),
  ('530', '雑費',         'expense',   'debit',  580);
```

- [ ] **Step 2: コミット**（Supabase での実行は Task 11 でまとめて行う）

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add supabase/migrations/008_accounting_core.sql && git commit -m "feat(accounting): SQL migration for accounting core tables + seed"
```

---

### Task 6: 科目マスタ API

**Files:**
- Create: `app/api/admin/accounting/accounts/route.ts`
- Create: `app/api/admin/accounting/accounts/[id]/route.ts`

- [ ] **Step 1: `app/api/admin/accounting/accounts/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const VALID_CATEGORIES = ['asset', 'liability', 'equity', 'revenue', 'expense']
const VALID_SIDES = ['debit', 'credit']

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('accounts').select('*').order('sort_order').order('code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { code, name, category, normal_balance, sort_order } = body
  if (!code || !name) return NextResponse.json({ error: 'code と name が必要です' }, { status: 400 })
  if (!VALID_CATEGORIES.includes(category as string))
    return NextResponse.json({ error: 'category が不正です' }, { status: 400 })
  if (!VALID_SIDES.includes(normal_balance as string))
    return NextResponse.json({ error: 'normal_balance が不正です' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('accounts').insert({
    code, name, category, normal_balance,
    sort_order: Number.isInteger(sort_order) ? sort_order : 999,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data }, { status: 201 })
}
```

- [ ] **Step 2: `app/api/admin/accounting/accounts/[id]/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { canDeleteAccount } from '@/lib/accounting/accountRules'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const update: Record<string, unknown> = {}
  if (body.name        !== undefined) update.name        = body.name
  if (body.code        !== undefined) update.code        = body.code
  if (body.sort_order  !== undefined) update.sort_order  = body.sort_order
  if (body.is_active   !== undefined) update.is_active   = Boolean(body.is_active)
  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: '更新するフィールドがありません' }, { status: 400 })

  const { error } = await supabaseAdmin.from('accounts').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: usedRows } = await supabaseAdmin
    .from('journal_lines').select('account_id').eq('account_id', params.id).limit(1)
  const usedIds = (usedRows ?? []).map(r => r.account_id as string)
  if (!canDeleteAccount(params.id, usedIds))
    return NextResponse.json({ error: '使用中の科目は削除できません（無効化してください）' }, { status: 409 })

  const { error } = await supabaseAdmin.from('accounts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 型チェック**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15`
Expected: 新規エラーなし

- [ ] **Step 4: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add app/api/admin/accounting/accounts && git commit -m "feat(accounting): accounts API (CRUD)"
```

---

### Task 7: 仕訳 API

**Files:**
- Create: `app/api/admin/accounting/entries/route.ts`
- Create: `app/api/admin/accounting/entries/[id]/route.ts`

POST/PATCH は保存前に `validateEntry()` で借貸一致を再検証する。

- [ ] **Step 1: `app/api/admin/accounting/entries/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateEntry } from '@/lib/accounting/validateEntry'
import type { JournalEntryInput } from '@/lib/accounting/types'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')

  let query = supabaseAdmin
    .from('journal_entries')
    .select('*, journal_lines(*)')
    .order('entry_date', { ascending: true })
  if (from) query = query.gte('entry_date', from)
  if (to)   query = query.lte('entry_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: JournalEntryInput
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const err = validateEntry(body)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { data: header, error: headerErr } = await supabaseAdmin
    .from('journal_entries')
    .insert({ entry_date: body.entryDate, description: body.description, source: 'manual' })
    .select().single()
  if (headerErr || !header)
    return NextResponse.json({ error: headerErr?.message ?? '仕訳の作成に失敗しました' }, { status: 500 })

  const lines = body.lines.map((l, i) => ({
    journal_entry_id: header.id,
    account_id: l.accountId,
    side: l.side,
    amount: l.amount,
    line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) {
    await supabaseAdmin.from('journal_entries').delete().eq('id', header.id)  // rollback
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }
  return NextResponse.json({ entryId: header.id }, { status: 201 })
}
```

- [ ] **Step 2: `app/api/admin/accounting/entries/[id]/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateEntry } from '@/lib/accounting/validateEntry'
import type { JournalEntryInput } from '@/lib/accounting/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('journal_entries').select('*, journal_lines(*)').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ entry: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: JournalEntryInput
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const err = validateEntry(body)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const { error: upErr } = await supabaseAdmin.from('journal_entries')
    .update({ entry_date: body.entryDate, description: body.description })
    .eq('id', params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // 明細は全削除→再挿入
  await supabaseAdmin.from('journal_lines').delete().eq('journal_entry_id', params.id)
  const lines = body.lines.map((l, i) => ({
    journal_entry_id: params.id, account_id: l.accountId, side: l.side, amount: l.amount, line_order: i,
  }))
  const { error: linesErr } = await supabaseAdmin.from('journal_lines').insert(lines)
  if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin.from('journal_entries').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add app/api/admin/accounting/entries && git commit -m "feat(accounting): journal entries API with balance validation"
```
Expected: 新規型エラーなし

---

### Task 8: 期首残高 API

**Files:**
- Create: `app/api/admin/accounting/opening-balances/route.ts`

- [ ] **Step 1: 作成**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = Number(req.nextUrl.searchParams.get('year')) || new Date().getFullYear()
  const { data, error } = await supabaseAdmin
    .from('opening_balances').select('*').eq('fiscal_year', year)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ openingBalances: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'リクエスト形式が不正です' }, { status: 400 })
  }
  const { fiscal_year, account_id, side, amount } = body
  if (!Number.isInteger(fiscal_year))  return NextResponse.json({ error: 'fiscal_year が必要です' }, { status: 400 })
  if (!account_id)                     return NextResponse.json({ error: 'account_id が必要です' }, { status: 400 })
  if (side !== 'debit' && side !== 'credit') return NextResponse.json({ error: 'side が不正です' }, { status: 400 })
  if (!Number.isInteger(amount) || (amount as number) < 0)
    return NextResponse.json({ error: 'amount は0以上の整数で入力してください' }, { status: 400 })

  const { error } = await supabaseAdmin.from('opening_balances')
    .upsert({ fiscal_year, account_id, side, amount }, { onConflict: 'fiscal_year,account_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add app/api/admin/accounting/opening-balances && git commit -m "feat(accounting): opening balances API"
```

---

### Task 9: 科目マスタ画面

**Files:**
- Create: `components/admin/accounting/AccountManager.tsx`
- Create: `app/admin/(dashboard)/accounting/accounts/page.tsx`

- [ ] **Step 1: `components/admin/accounting/AccountManager.tsx` を作成**

```tsx
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
```

- [ ] **Step 2: `app/admin/(dashboard)/accounting/accounts/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import AccountManager from '@/components/admin/accounting/AccountManager'

export const revalidate = 0

export default async function AccountsPage() {
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('*').order('sort_order').order('code')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">勘定科目マスタ</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <AccountManager initialAccounts={accounts ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add components/admin/accounting/AccountManager.tsx "app/admin/(dashboard)/accounting/accounts/page.tsx" && git commit -m "feat(accounting): account master management page"
```

---

### Task 10: 仕訳帳・仕訳入力フォーム

**Files:**
- Create: `components/admin/accounting/JournalEntryForm.tsx`
- Create: `app/admin/(dashboard)/accounting/journal/page.tsx`

- [ ] **Step 1: `components/admin/accounting/JournalEntryForm.tsx` を作成**

```tsx
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
```

- [ ] **Step 2: `app/admin/(dashboard)/accounting/journal/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import JournalEntryForm from '@/components/admin/accounting/JournalEntryForm'

export const revalidate = 0

interface Line { id: string; account_id: string; side: string; amount: number }
interface Entry { id: string; entry_date: string; description: string; journal_lines: Line[] }

export default async function JournalPage() {
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('id, code, name, is_active').order('sort_order').order('code')
  const { data: entries } = await supabaseAdmin
    .from('journal_entries').select('*, journal_lines(*)').order('entry_date', { ascending: false }).limit(100)

  const accountName = (id: string) => accounts?.find(a => a.id === id)?.name ?? '—'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">仕訳帳</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>

      <JournalEntryForm accounts={accounts ?? []} />

      <div className="space-y-2">
        {(entries as Entry[] ?? []).map(e => (
          <div key={e.id} className="bg-white border border-warm-100 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-warm-500">{e.entry_date}</span>
              <span className="text-warm-700">{e.description}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {e.journal_lines.sort((a, b) => (a.side === 'debit' ? -1 : 1)).map(l => (
                  <tr key={l.id}>
                    <td className="text-warm-400 w-12">{l.side === 'debit' ? '借' : '貸'}</td>
                    <td className="text-warm-700">{accountName(l.account_id)}</td>
                    <td className="text-right text-warm-700">¥{l.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {(!entries || entries.length === 0) && <p className="text-warm-400 text-sm text-center py-8">仕訳はまだありません</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 型チェック＋コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15 && git add components/admin/accounting/JournalEntryForm.tsx "app/admin/(dashboard)/accounting/journal/page.tsx" && git commit -m "feat(accounting): journal entry form and journal page"
```

---

### Task 11: 総勘定元帳・試算表・期首残高・会計トップ・ナビ

**Files:**
- Create: `app/admin/(dashboard)/accounting/ledger/page.tsx`
- Create: `app/admin/(dashboard)/accounting/trial-balance/page.tsx`
- Create: `app/admin/(dashboard)/accounting/opening/page.tsx`
- Create: `components/admin/accounting/OpeningBalanceForm.tsx`
- Create: `app/admin/(dashboard)/accounting/page.tsx`
- Modify: `app/admin/(dashboard)/layout.tsx`

このタスクは Server Component で `lib/accounting` の純粋関数を使って集計表示する。DB の行（snake_case）を純粋関数の型（camelCase）に変換するヘルパーを各ページ内に持つ。

- [ ] **Step 1: `app/admin/(dashboard)/accounting/trial-balance/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { computeTrialBalance } from '@/lib/accounting/trialBalance'
import type { PostedLine } from '@/lib/accounting/trialBalance'
import type { Account, OpeningBalance } from '@/lib/accounting/types'

export const revalidate = 0

interface Props { searchParams: { year?: string } }

export default async function TrialBalancePage({ searchParams }: Props) {
  const year = Number(searchParams.year) || new Date().getFullYear()

  const { data: accRows } = await supabaseAdmin.from('accounts').select('*').order('sort_order').order('code')
  const { data: lineRows } = await supabaseAdmin
    .from('journal_lines')
    .select('account_id, side, amount, journal_entries!inner(entry_date)')
    .gte('journal_entries.entry_date', `${year}-01-01`)
    .lte('journal_entries.entry_date', `${year}-12-31`)
  const { data: obRows } = await supabaseAdmin.from('opening_balances').select('*').eq('fiscal_year', year)

  const accounts: Account[] = (accRows ?? []).map(a => ({
    id: a.id, code: a.code, name: a.name, category: a.category,
    normalBalance: a.normal_balance, isActive: a.is_active, sortOrder: a.sort_order,
  }))
  const lines: PostedLine[] = (lineRows ?? []).map(l => ({
    accountId: l.account_id, side: l.side, amount: l.amount,
  }))
  const openingBalances: OpeningBalance[] = (obRows ?? []).map(o => ({
    accountId: o.account_id, side: o.side, amount: o.amount,
  }))

  const tb = computeTrialBalance(accounts, lines, openingBalances)
  const visible = tb.rows.filter(r => r.debitTotal !== 0 || r.creditTotal !== 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">試算表（{year}年）</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <table className="w-full text-sm bg-white border border-warm-100 rounded-xl overflow-hidden">
        <thead>
          <tr className="text-warm-400 border-b border-warm-100 text-left">
            <th className="py-2 px-3">科目</th>
            <th className="text-right px-3">借方合計</th>
            <th className="text-right px-3">貸方合計</th>
            <th className="text-right px-3">残高</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.account.id} className="border-b border-warm-50">
              <td className="py-2 px-3 text-warm-700">{r.account.name}</td>
              <td className="text-right px-3 text-warm-600">¥{r.debitTotal.toLocaleString()}</td>
              <td className="text-right px-3 text-warm-600">¥{r.creditTotal.toLocaleString()}</td>
              <td className="text-right px-3 text-warm-700 font-medium">¥{r.balance.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-warm-200 font-bold">
            <td className="py-2 px-3 text-warm-700">合計</td>
            <td className="text-right px-3">¥{tb.totalDebit.toLocaleString()}</td>
            <td className="text-right px-3">¥{tb.totalCredit.toLocaleString()}</td>
            <td className="text-right px-3">{tb.balanced ? '✓ 一致' : '✗ 不一致'}</td>
          </tr>
        </tfoot>
      </table>
      {!tb.balanced && <p className="text-red-500 text-sm mt-3">⚠ 借方合計と貸方合計が一致していません。仕訳を確認してください。</p>}
    </div>
  )
}
```

- [ ] **Step 2: `app/admin/(dashboard)/accounting/ledger/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { computeLedger } from '@/lib/accounting/ledger'
import type { PostedEntry } from '@/lib/accounting/ledger'
import type { Account } from '@/lib/accounting/types'

export const revalidate = 0

interface Props { searchParams: { account?: string; year?: string } }

export default async function LedgerPage({ searchParams }: Props) {
  const year = Number(searchParams.year) || new Date().getFullYear()
  const { data: accRows } = await supabaseAdmin.from('accounts').select('*').order('sort_order').order('code')
  const accounts = accRows ?? []
  const selectedId = searchParams.account || accounts[0]?.id

  let rows: ReturnType<typeof computeLedger> = []
  let selectedAccount: Account | undefined
  let openingBalance = 0

  if (selectedId) {
    const a = accounts.find(x => x.id === selectedId)
    if (a) {
      selectedAccount = {
        id: a.id, code: a.code, name: a.name, category: a.category,
        normalBalance: a.normal_balance, isActive: a.is_active, sortOrder: a.sort_order,
      }
      const { data: ob } = await supabaseAdmin.from('opening_balances')
        .select('side, amount').eq('fiscal_year', year).eq('account_id', selectedId).maybeSingle()
      if (ob) openingBalance = ob.side === selectedAccount.normalBalance ? ob.amount : -ob.amount

      const { data: entryRows } = await supabaseAdmin
        .from('journal_entries')
        .select('entry_date, description, journal_lines(account_id, side, amount)')
        .gte('entry_date', `${year}-01-01`).lte('entry_date', `${year}-12-31`)
        .order('entry_date', { ascending: true })

      const nameById = (id: string) => accounts.find(x => x.id === id)?.name ?? '—'
      const entries: PostedEntry[] = (entryRows ?? []).map(e => ({
        date: e.entry_date, description: e.description,
        lines: (e.journal_lines as { account_id: string; side: 'debit' | 'credit'; amount: number }[])
          .map(l => ({ accountId: l.account_id, side: l.side, amount: l.amount, accountName: nameById(l.account_id) })),
      }))
      rows = computeLedger(selectedId, selectedAccount, entries, openingBalance)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">総勘定元帳（{year}年）</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>

      <form className="mb-4">
        <select name="account" defaultValue={selectedId}
          className="border border-warm-200 rounded-lg px-3 py-2 text-sm"
          // server form: change submits via GET
        >
          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
        </select>
        <button className="ml-2 bg-warm-500 text-white px-4 py-2 rounded-lg text-sm">表示</button>
      </form>

      <table className="w-full text-sm bg-white border border-warm-100 rounded-xl overflow-hidden">
        <thead>
          <tr className="text-warm-400 border-b border-warm-100 text-left">
            <th className="py-2 px-3">日付</th><th className="px-3">摘要</th><th className="px-3">相手科目</th>
            <th className="text-right px-3">借方</th><th className="text-right px-3">貸方</th><th className="text-right px-3">残高</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-warm-50 text-warm-400">
            <td className="py-2 px-3" colSpan={5}>前期繰越</td>
            <td className="text-right px-3">¥{openingBalance.toLocaleString()}</td>
          </tr>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-warm-50">
              <td className="py-2 px-3 text-warm-500">{r.date}</td>
              <td className="px-3 text-warm-700">{r.entryDescription}</td>
              <td className="px-3 text-warm-500">{r.counterAccountName}</td>
              <td className="text-right px-3 text-warm-600">{r.debit ? `¥${r.debit.toLocaleString()}` : ''}</td>
              <td className="text-right px-3 text-warm-600">{r.credit ? `¥${r.credit.toLocaleString()}` : ''}</td>
              <td className="text-right px-3 text-warm-700 font-medium">¥{r.balance.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: `components/admin/accounting/OpeningBalanceForm.tsx` を作成**

```tsx
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
```

- [ ] **Step 4: `app/admin/(dashboard)/accounting/opening/page.tsx` を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import OpeningBalanceForm from '@/components/admin/accounting/OpeningBalanceForm'

export const revalidate = 0

interface Props { searchParams: { year?: string } }

export default async function OpeningPage({ searchParams }: Props) {
  const year = Number(searchParams.year) || new Date().getFullYear()
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('id, code, name, normal_balance').eq('is_active', true).order('sort_order').order('code')
  const { data: initial } = await supabaseAdmin
    .from('opening_balances').select('account_id, side, amount').eq('fiscal_year', year)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-warm-700">期首残高（{year}年）</h1>
        <Link href="/admin/accounting" className="text-warm-500 text-sm hover:text-warm-700">← 会計トップ</Link>
      </div>
      <p className="text-warm-400 text-sm mb-4">各科目の期首残高を入力します。開業初年度は元入金などを設定してください。</p>
      <OpeningBalanceForm accounts={accounts ?? []} year={year} initial={initial ?? []} />
    </div>
  )
}
```

- [ ] **Step 5: `app/admin/(dashboard)/accounting/page.tsx`（会計トップ）を作成**

```tsx
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { computeTrialBalance } from '@/lib/accounting/trialBalance'
import type { PostedLine } from '@/lib/accounting/trialBalance'
import type { Account, OpeningBalance } from '@/lib/accounting/types'

export const revalidate = 0

const LINKS = [
  { href: '/admin/accounting/journal',        label: '仕訳帳',         icon: '📒' },
  { href: '/admin/accounting/ledger',         label: '総勘定元帳',     icon: '📚' },
  { href: '/admin/accounting/trial-balance',  label: '試算表',         icon: '⚖️' },
  { href: '/admin/accounting/accounts',       label: '勘定科目マスタ', icon: '🏷️' },
  { href: '/admin/accounting/opening',        label: '期首残高',       icon: '🌱' },
]

export default async function AccountingTop() {
  const year = new Date().getFullYear()
  const { data: accRows } = await supabaseAdmin.from('accounts').select('*')
  const { data: lineRows } = await supabaseAdmin
    .from('journal_lines')
    .select('account_id, side, amount, journal_entries!inner(entry_date)')
    .gte('journal_entries.entry_date', `${year}-01-01`).lte('journal_entries.entry_date', `${year}-12-31`)
  const { data: obRows } = await supabaseAdmin.from('opening_balances').select('*').eq('fiscal_year', year)

  const accounts: Account[] = (accRows ?? []).map(a => ({
    id: a.id, code: a.code, name: a.name, category: a.category,
    normalBalance: a.normal_balance, isActive: a.is_active, sortOrder: a.sort_order,
  }))
  const lines: PostedLine[] = (lineRows ?? []).map(l => ({ accountId: l.account_id, side: l.side, amount: l.amount }))
  const openingBalances: OpeningBalance[] = (obRows ?? []).map(o => ({ accountId: o.account_id, side: o.side, amount: o.amount }))
  const tb = computeTrialBalance(accounts, lines, openingBalances)

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-warm-700 mb-6">会計（{year}年）</h1>

      <div className="bg-white border border-warm-100 rounded-xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-warm-400 text-xs mb-1">試算表 借貸チェック</p>
          <p className={`font-bold text-lg ${tb.balanced ? 'text-green-600' : 'text-red-500'}`}>
            {tb.balanced ? '✓ 借方=貸方 一致' : '✗ 不一致'}
          </p>
        </div>
        <div className="text-right text-sm text-warm-500">
          <p>借方合計 ¥{tb.totalDebit.toLocaleString()}</p>
          <p>貸方合計 ¥{tb.totalCredit.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href}
            className="bg-white border border-warm-100 rounded-xl p-5 hover:shadow-md transition-shadow text-center">
            <div className="text-3xl mb-2">{l.icon}</div>
            <div className="text-warm-700 font-medium">{l.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: `app/admin/(dashboard)/layout.tsx` のナビに会計を追加**

ナビ配列の投稿管理（`📝 投稿管理`）の後に追加:
```typescript
{ href: '/admin/accounting', label: '🧮 会計' },
```

- [ ] **Step 7: 型チェック・ビルド・全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -20
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 型エラーなし・ビルド成功・全テスト pass

- [ ] **Step 8: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add "app/admin/(dashboard)/accounting" components/admin/accounting/OpeningBalanceForm.tsx "app/admin/(dashboard)/layout.tsx" && git commit -m "feat(accounting): ledger, trial balance, opening balance, top page + nav"
```

---

### Task 12: SQL マイグレーション実行＋デプロイ

**Files:** なし（Supabase で SQL 実行、Vercel へデプロイ）

- [ ] **Step 1: SQL をクリップボードにコピー**

```bash
cat "C:/Users/biscu/Downloads/bluesky-camp/supabase/migrations/008_accounting_core.sql" | clip
```

- [ ] **Step 2: Supabase SQL エディタで実行**

`https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/sql/new` を開き、貼り付けて Run。
Expected: 「Success. No rows returned」

- [ ] **Step 3: テーブル作成を確認**

```bash
node -e "
const https=require('https');
const k=process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZGlhZmtkamVhc2xod2x2ZnhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU3ODAyNSwiZXhwIjoyMDk0MTU0MDI1fQ.vg5_LezAvImZm8OA0CWdBnwY_kp9lj9UlE5rekZ4mhg';
https.get({hostname:'frdiafkdjeaslhwlvfxa.supabase.co',path:'/rest/v1/accounts?select=code&limit=1',headers:{Authorization:'Bearer '+k,apikey:k}},r=>console.log('accounts:',r.statusCode===200?'OK':'ERR '+r.statusCode))
"
```
Expected: `accounts: OK`

- [ ] **Step 4: デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`
