# 会計システム サブプロジェクトA：複式簿記コア 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 App Router / Supabase / TypeScript / TailwindCSS）
> 全体方針: 「予約 → 売上 → 仕入/経費 → 青色申告」を実現する会計サブシステムを、依存順に5サブプロジェクト（A〜E）へ分割。本書はその土台 **A：複式簿記コア** の設計。

---

## 0. 全体像（サブプロジェクト分割）

| 順 | サブプロジェクト | 内容 | 本書 |
|----|----------------|------|------|
| **A** | 複式簿記コア | 勘定科目・仕訳・総勘定元帳・試算表・期首残高 | ★本書 |
| B | 売上連携 | 予約確定→前受金、宿泊完了→売上 の自動仕訳 | 別途 |
| C | 経費入力＋レシートOCR | 手入力＋画像AIで下書き→確認→確定 | 別途 |
| D | 固定資産・減価償却 | 固定資産台帳・定額法・直接法 | 別途 |
| E | 決算書＋エクスポート | P/L・B/S・青色申告決算書の数字・CSV出力 | 別途 |

**前提条件（全体）**
- 事業形態: 個人事業主、**青色申告 65万円控除**狙い（複式簿記＋B/S＋P/L 必須）
- 売上計上: **宿泊完了日**（役務提供完了）。事前入金は前受金で受け、完了時に売上へ振替（サブプロジェクトBで実装）
- 消費税: 当面 **免税事業者**。税区分の入力欄だけ用意し、将来の課税対応に備える
- 減価償却: **直接法**（サブプロジェクトDで実装）
- e-Tax 直接送信: **作らない**。青色申告決算書の数字とCSVを出すところまで（送信は国税庁「確定申告書等作成コーナー」/会計ソフト/税理士に委ねる）
- 会計年度: 1/1〜12/31 固定

---

## A-1. ゴール（このサブプロジェクトの完成状態）

このサブプロジェクト単体で「**手入力で複式簿記がつけられ、総勘定元帳・試算表が出せる**」状態になる。税理士に渡せる最低限の帳簿が完成する。

---

## A-2. データモデル

すべて Supabase の新規テーブル。`supabaseAdmin`（サーバ）でアクセスし、RLS を有効化（認証は admin セッションで担保、公開読み取りは無し）。

### ① `accounts`（勘定科目マスタ）

```sql
CREATE TABLE accounts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text        NOT NULL UNIQUE,         -- 科目コード（例: "101"）
  name           text        NOT NULL,                -- 科目名（例: "現金"）
  category       text        NOT NULL,                -- 'asset'|'liability'|'equity'|'revenue'|'expense'
  normal_balance text        NOT NULL,                -- 'debit'|'credit'（通常残高の側）
  is_active      boolean     NOT NULL DEFAULT true,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_accounts_category ON accounts (category);
CREATE INDEX idx_accounts_active   ON accounts (is_active);
```

`category` と `normal_balance` の対応（増加する側）:
| category | 日本語 | normal_balance |
|----------|--------|----------------|
| asset | 資産 | debit |
| liability | 負債 | credit |
| equity | 純資産 | credit |
| revenue | 収益 | credit |
| expense | 費用 | debit |

※ 例外: `事業主貸` は equity だが借方が増える特殊科目。`normal_balance='debit'` を個別設定する（seed で対応）。

### ② `journal_entries`（仕訳ヘッダ）

```sql
CREATE TABLE journal_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  date        NOT NULL,
  description text        NOT NULL DEFAULT '',     -- 摘要
  source      text        NOT NULL DEFAULT 'manual', -- 'manual'|'reservation'|'depreciation'
  source_id   text,                                 -- 元データID（予約ID等・任意）
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_journal_entries_date   ON journal_entries (entry_date);
CREATE INDEX idx_journal_entries_source ON journal_entries (source, source_id);
```

### ③ `journal_lines`（仕訳明細）

```sql
CREATE TABLE journal_lines (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid    NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       uuid    NOT NULL REFERENCES accounts(id),
  side             text    NOT NULL,              -- 'debit'|'credit'
  amount           integer NOT NULL CHECK (amount > 0),  -- 円・正の整数
  tax_category     text,                          -- 税区分（将来用・今はnull）
  line_order       integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_journal_lines_entry   ON journal_lines (journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines (account_id);
```

### ④ `opening_balances`（期首残高）

```sql
CREATE TABLE opening_balances (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year  integer NOT NULL,                  -- 例: 2026
  account_id   uuid    NOT NULL REFERENCES accounts(id),
  side         text    NOT NULL,                  -- 'debit'|'credit'
  amount       integer NOT NULL CHECK (amount >= 0),
  UNIQUE (fiscal_year, account_id)
);
CREATE INDEX idx_opening_balances_year ON opening_balances (fiscal_year);
```

### 不変条件（最重要）
1 仕訳 = ヘッダ1件 ＋ 明細2件以上。**明細の借方合計 ＝ 貸方合計** を常に保つ。保存APIで検証し、不一致は拒否する。

---

## A-3. 純粋ロジック（`lib/accounting/`・テスト対象）

DB に依存しない純粋関数として実装し、Vitest でユニットテストする。

### 型（`lib/accounting/types.ts`）

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
  entryDate: string          // 'YYYY-MM-DD'
  description: string
  lines: JournalLineInput[]
}

export interface OpeningBalance {
  accountId: string
  side: Side
  amount: number
}
```

### `validateEntry(entry): string | null`（`lib/accounting/validateEntry.ts`）
仕訳の検証。問題があれば日本語エラー文字列、なければ `null`。

ルール:
1. 明細が2件以上 → 違反: `'明細は2件以上必要です'`
2. 各 amount が正の整数 → 違反: `'金額は正の整数で入力してください'`
3. 各 side が 'debit'|'credit' → 違反: `'借方・貸方の指定が不正です'`
4. 借方合計 === 貸方合計 → 違反: `` `借方と貸方の合計が一致しません（借方 ¥${d.toLocaleString()} / 貸方 ¥${c.toLocaleString()}）` ``

### `computeTrialBalance(accounts, entries, openingBalances)`（`lib/accounting/trialBalance.ts`）
全科目の借方合計・貸方合計・期末残高を集計して返す。

出力:
```typescript
interface TrialBalanceRow {
  account: Account
  debitTotal: number    // 期中の借方合計（期首含む）
  creditTotal: number
  balance: number       // normalBalance 側を正とした期末残高
}
interface TrialBalanceResult {
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  balanced: boolean     // totalDebit === totalCredit
}
```
期首残高は対応する side に加算してから集計する。`balance` は科目の `normalBalance` 側を正とする（資産・費用は debit−credit、負債・純資産・収益は credit−debit）。

### `computeLedger(accountId, account, entries, openingBalance)`（`lib/accounting/ledger.ts`）
指定科目の総勘定元帳。明細を日付順に並べ、残高を累計。

出力:
```typescript
interface LedgerRow {
  date: string
  entryDescription: string
  counterAccountName: string | null  // 相手科目（明細が2件の単純仕訳のときのみ。複合仕訳はnull→「諸口」表示）
  debit: number
  credit: number
  balance: number                    // normalBalance 側を正とした running balance
}
```

### `canDeleteAccount(accountId, entries): boolean`（`lib/accounting/accountRules.ts`）
仕訳明細で一度も使われていなければ削除可（true）。使用済みは false（→ 無効化のみ）。

---

## A-4. 画面（`/admin/accounting/*`）

すべて既存の admin ダッシュボード `(dashboard)` ルートグループ配下に置き、認証を継承する。

| パス | 画面 | 主な内容 |
|------|------|---------|
| `/admin/accounting` | 会計トップ | 当年度の試算表サマリー（借貸合計＋一致チェック）、各帳簿へのリンク、年度切替 |
| `/admin/accounting/journal` | 仕訳帳 | 仕訳一覧（日付・摘要・借方科目/貸方科目・金額）＋「新規仕訳」フォーム＋編集/削除 |
| `/admin/accounting/ledger` | 総勘定元帳 | 科目プルダウン選択 → 明細＋残高推移を表示 |
| `/admin/accounting/trial-balance` | 試算表 | 全科目の借方/貸方/残高一覧、最下行に合計と借貸一致チェック |
| `/admin/accounting/accounts` | 科目マスタ | 追加・編集・並べ替え・無効化（使用済みは削除不可）|
| `/admin/accounting/opening` | 期首残高 | 年度を選び、各科目の期首残高を入力 |

### 仕訳入力フォーム（クライアントコンポーネント）
- 日付（date input）・摘要（text）
- 明細行を動的に追加/削除（借方/貸方トグル・科目プルダウン・金額）
- **借方合計・貸方合計・差額をリアルタイム表示**。一致で緑、不一致で赤＋保存ボタン無効
- 科目プルダウンは `is_active=true` のみ表示、コード順
- 保存時にサーバ側でも `validateEntry()` を再検証

### ナビゲーション
`app/admin/(dashboard)/layout.tsx` のナビ配列に **`🧮 会計`**（`/admin/accounting`）を追加。会計トップ内に上記サブ画面へのタブ/リンクを置く。

---

## A-5. API（`/api/admin/accounting/*`・全て admin 認証必須）

既存の admin API パターン（`createSupabaseServerClient().auth.getSession()` でガード、`supabaseAdmin` で DML）を踏襲。

| ルート | メソッド | 内容 |
|--------|---------|------|
| `/api/admin/accounting/accounts` | GET | 全科目（コード順）|
| | POST | 科目追加（code 重複・category 妥当性を検証）|
| `/api/admin/accounting/accounts/[id]` | PATCH | 名称・コード・並び順・is_active 更新 |
| | DELETE | `canDeleteAccount` が true のときのみ削除、false は 409 |
| `/api/admin/accounting/entries` | GET | 期間（from/to）・科目フィルタで仕訳取得（ヘッダ＋明細）|
| | POST | `validateEntry()` 通過時のみヘッダ＋明細をトランザクション的に挿入 |
| `/api/admin/accounting/entries/[id]` | GET | 単一仕訳（明細つき）|
| | PATCH | 明細を入れ替え（全削除→再挿入）、再検証 |
| | DELETE | ヘッダ削除（明細は CASCADE）|
| `/api/admin/accounting/opening-balances` | GET | 年度の期首残高一覧 |
| | POST | 年度＋科目で upsert |

**POST /entries の挿入順:** ヘッダを insert → 返った id で明細を一括 insert。明細 insert が失敗したらヘッダを削除（簡易ロールバック）。

---

## A-6. 初期勘定科目（seed・SQL migration に含める）

青色申告決算書（一般用）の標準科目に準拠。すべて編集・無効化可能。`事業主貸` のみ equity だが normal_balance=debit。

| code | name | category | normal_balance |
|------|------|----------|----------------|
| 101 | 現金 | asset | debit |
| 102 | 普通預金 | asset | debit |
| 103 | 売掛金 | asset | debit |
| 104 | 前払金 | asset | debit |
| 151 | 工具器具備品 | asset | debit |
| 152 | 建物 | asset | debit |
| 153 | 車両運搬具 | asset | debit |
| 201 | 買掛金 | liability | credit |
| 202 | 未払金 | liability | credit |
| 203 | 前受金 | liability | credit |
| 204 | 預り金 | liability | credit |
| 211 | 借入金 | liability | credit |
| 301 | 元入金 | equity | credit |
| 302 | 事業主貸 | equity | debit |
| 303 | 事業主借 | equity | credit |
| 401 | 売上高 | revenue | credit |
| 402 | 雑収入 | revenue | credit |
| 501 | 仕入高 | expense | debit |
| 511 | 租税公課 | expense | debit |
| 512 | 水道光熱費 | expense | debit |
| 513 | 旅費交通費 | expense | debit |
| 514 | 通信費 | expense | debit |
| 515 | 広告宣伝費 | expense | debit |
| 516 | 接待交際費 | expense | debit |
| 517 | 損害保険料 | expense | debit |
| 518 | 修繕費 | expense | debit |
| 519 | 消耗品費 | expense | debit |
| 520 | 減価償却費 | expense | debit |
| 521 | 福利厚生費 | expense | debit |
| 522 | 給料賃金 | expense | debit |
| 523 | 外注工賃 | expense | debit |
| 524 | 利子割引料 | expense | debit |
| 525 | 地代家賃 | expense | debit |
| 526 | 支払手数料 | expense | debit |
| 530 | 雑費 | expense | debit |

---

## A-7. テスト方針

| 対象 | ケース |
|------|--------|
| `validateEntry` | 借貸一致でnull / 不一致でエラー / 明細1件で拒否 / 金額0・負数・小数で拒否 / side不正で拒否 |
| `computeTrialBalance` | 複数仕訳の集計が正確 / 全体借貸一致 / 期首残高の反映 / 残高の符号（資産 vs 負債）|
| `computeLedger` | 残高の累計が正確 / 資産科目（借方増）と負債科目（貸方増）で符号が正しい / 相手科目の表示（単純仕訳=相手名、複合=「諸口」）|
| `canDeleteAccount` | 未使用=true / 使用済み=false |

API・画面は既存パターン（admin認証・型）に準拠。E2E は後続サブプロジェクト完了後にまとめて追加。

---

## A-8. ファイル構成（予定）

| ファイル | 役割 |
|---------|------|
| `supabase/migrations/008_accounting_core.sql` | 4テーブル＋RLS＋科目seed |
| `lib/accounting/types.ts` | 型定義 |
| `lib/accounting/validateEntry.ts` | 仕訳検証 |
| `lib/accounting/trialBalance.ts` | 試算表計算 |
| `lib/accounting/ledger.ts` | 総勘定元帳計算 |
| `lib/accounting/accountRules.ts` | 科目削除可否 |
| `lib/accounting/__tests__/*.test.ts` | ユニットテスト |
| `app/api/admin/accounting/accounts/route.ts` ほか | API |
| `app/admin/(dashboard)/accounting/**` | 画面6つ |
| `components/admin/accounting/JournalEntryForm.tsx` ほか | 仕訳フォーム等 |
| `app/admin/(dashboard)/layout.tsx` | ナビに「🧮 会計」追加（修正）|

---

## A-9. 非対象（このサブプロジェクトでやらないこと）

- 予約からの自動仕訳（→ B）
- 経費・レシートOCR（→ C）
- 固定資産・減価償却（→ D）
- P/L・B/S・青色申告決算書・CSVエクスポート（→ E）
- 消費税の集計（当面免税。税区分欄のみ用意）
- e-Tax 直接送信（全体方針として非対象）
