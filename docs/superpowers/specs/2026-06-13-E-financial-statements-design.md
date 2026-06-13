# サブプロジェクト E：決算書（P/L・B/S・青色申告 CSV）設計書

**作成日**: 2026-06-13
**前提**: B-1〜B-5、B-7a、B-7b 本番稼働中。B-6 保留。B-4 で `accounts` / `journal_entries` / `journal_lines` テーブルと売上仕訳・棚卸仕訳が稼働済み。

## E 目的

個人事業主の **青色申告 65万円控除** に向けて、既存仕訳データから次を生成する:

1. **損益計算書（P/L）** を画面表示
2. **貸借対照表（B/S）** を画面表示
3. **月次／年次** 切替（暦月単位 = 1日〜末日、年度 = 1/1〜12/31）
4. **弥生青色申告 CSV** と **freee CSV** で仕訳エクスポート（Shift_JIS / UTF-8 BOM 対応）

非目的（スコープ外）:
- 減価償却の自動計算（既存「減価償却費」科目への手動仕訳は集計に含むが、自動仕訳は別途）
- e-Tax XBRL/XML 直接生成（弥生・freee 経由で電子申告）
- PDF 出力（B-3 の `@react-pdf/renderer` 基盤あり、必要なら後付け）
- 前月比・前年同月比などの比較表示
- 部門別集計
- 消費税申告書

---

## アーキテクチャ

```
journal_lines + accounts
       ▼ aggregatePeriod(lines, periodStart, periodEnd)
AccountSummary[] + totals
       ▼ applyTaxMapping(summary, mapping)
TaxStyledReport { revenue, purchases, expenses[18科目], bsAssets/Liabilities/Equity, unmapped }
       ▼
画面表示 (/admin/accounting/report)
       ▼ + CSV ボタン
GET /api/admin/accounting/csv?format=yayoi|freee&year&month?
       ▼ yayoiExport / freeeExport
.csv ダウンロード
```

### 新規ファイル

```
lib/accounting/
  ├── aggregatePeriod.ts            純粋関数（期間集計）
  ├── taxMapping.ts                 青色申告書 18 科目マッピング定義
  ├── applyTaxMapping.ts            純粋関数（集計 → 青色申告書フォーマット）
  ├── csv/
  │   ├── yayoiExport.ts            純粋関数（仕訳 → 弥生CSV文字列）
  │   └── freeeExport.ts            純粋関数（仕訳 → freee CSV文字列）
  └── __tests__/
        ├── aggregatePeriod.test.ts
        ├── applyTaxMapping.test.ts
        ├── yayoiExport.test.ts
        └── freeeExport.test.ts

app/api/admin/accounting/
  ├── report/route.ts               GET（期間集計 + マッピング適用）
  └── csv/route.ts                  GET（CSV ダウンロード）

app/admin/(dashboard)/accounting/report/
  ├── page.tsx                      P/L + B/S 画面
  ├── PeriodSelector.tsx            年度・月次切替バー（Client Component）
  └── DrillDownDrawer.tsx           数値タップで内訳を表示
```

### 変更ファイル

- `app/admin/(dashboard)/layout.tsx`: サイドバーに `/admin/accounting/report` リンク追加

### 変更しない

- テーブル構造（`accounts` / `journal_entries` / `journal_lines`）
- 既存 B-4 ロジック（`/admin/accounting/journal`, `/admin/accounting/ledger`, `/admin/accounting/trial-balance`）
- 既存 `postSaleEntry` / `postSaleConsumption`

### 依存ライブラリ

- `iconv-lite` を新規追加（弥生 CSV の Shift_JIS 変換用）

---

## 期間集計ロジック

### 入力型

```typescript
interface JournalLineRow {
  account_id: string
  account_code: string
  account_name: string
  account_category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normal_balance: 'debit' | 'credit'
  side: 'debit' | 'credit'
  amount: number
  entry_date: string             // YYYY-MM-DD
}
```

### 出力型

```typescript
interface AccountSummary {
  accountId: string
  code: string
  name: string
  category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  debitTotal: number
  creditTotal: number
  balance: number                // normal_balance を考慮した残高（負なら反対残）
}
```

### 関数シグネチャ

```typescript
function aggregatePeriod(
  lines: JournalLineRow[],
  periodStart: string,    // YYYY-MM-DD inclusive
  periodEnd: string,      // YYYY-MM-DD inclusive
): {
  accounts: AccountSummary[]
  totals: {
    revenue: number
    expense: number
    netIncome: number      // revenue - expense
    assets: number
    liabilities: number
    equity: number
  }
}
```

### ルール

- **P/L 系科目（revenue / expense）**: `periodStart ≤ entry_date ≤ periodEnd` の合計
- **B/S 系科目（asset / liability / equity）**: `entry_date ≤ periodEnd` の累積（期首は無視、期末時点の残高）
- 残高 0 の科目は出力から除外
- `balance` 計算: normal_balance='debit' の科目は `debitTotal - creditTotal`、'credit' の科目は `creditTotal - debitTotal`

---

## 科目マッピング

### `lib/accounting/taxMapping.ts`

```typescript
export const PL_REVENUE = {
  key: 'revenue', label: '売上（収入）金額',
  accountCodes: ['401']
} as const

export const PL_PURCHASES = {
  key: 'purchases', label: '仕入金額',
  accountCodes: ['501']
} as const

export const PL_TAX_CATEGORIES = [
  { key: 'salary',        label: '給料賃金',     accountCodes: ['521'] },
  { key: 'outsourcing',   label: '外注工賃',     accountCodes: ['522'] },
  { key: 'depreciation',  label: '減価償却費',   accountCodes: ['561'] },
  { key: 'bad_debt',      label: '貸倒金',       accountCodes: ['571'] },
  { key: 'rent',          label: '地代家賃',     accountCodes: ['541'] },
  { key: 'interest',      label: '利子割引料',   accountCodes: ['542'] },
  { key: 'tax',           label: '租税公課',     accountCodes: ['543'] },
  { key: 'packaging',     label: '荷造運賃',     accountCodes: ['544'] },
  { key: 'utility',       label: '水道光熱費',   accountCodes: ['545'] },
  { key: 'travel',        label: '旅費交通費',   accountCodes: ['546'] },
  { key: 'communication', label: '通信費',       accountCodes: ['547'] },
  { key: 'advertising',   label: '広告宣伝費',   accountCodes: ['548'] },
  { key: 'entertainment', label: '接待交際費',   accountCodes: ['549'] },
  { key: 'insurance',     label: '損害保険料',   accountCodes: ['550'] },
  { key: 'repair',        label: '修繕費',       accountCodes: ['551'] },
  { key: 'supplies',      label: '消耗品費',     accountCodes: ['552'] },
  { key: 'welfare',       label: '福利厚生費',   accountCodes: ['553'] },
  { key: 'other_expense', label: '雑費',         accountCodes: ['599'] },
] as const

export const BS_CATEGORIES = [
  { key: 'cashEquivalents', label: '現金・預金',         section: 'asset',     accountCodes: ['101','102','103'] },
  { key: 'receivables',     label: '売掛金',             section: 'asset',     accountCodes: ['112'] },
  { key: 'inventory',       label: '棚卸資産',           section: 'asset',     accountCodes: ['105'] },
  { key: 'fixedAssets',     label: '固定資産',           section: 'asset',     codePrefix: '15' },
  { key: 'payables',        label: '買掛金',             section: 'liability', accountCodes: ['212'] },
  { key: 'loans',           label: '借入金',             section: 'liability', accountCodes: ['221'] },
  { key: 'capital',         label: '元入金',             section: 'equity',    accountCodes: ['311'] },
  { key: 'retainedEarnings',label: '当期純利益',         section: 'equity',    computed: 'netIncome' },
] as const
```

**注意**: 上記コード番号は **代表例**で、実装着手時に Supabase で `SELECT code, name, category FROM accounts ORDER BY code;` を確認して必要なら調整する。マッピング表は1ファイルで全部見渡せる構造。

### `applyTaxMapping` 純粋関数

```typescript
interface TaxStyledReport {
  revenue: { label: string; amount: number; accounts: AccountSummary[] }
  purchases: { label: string; amount: number; accounts: AccountSummary[] }
  expenses: Array<{ key: string; label: string; amount: number; accounts: AccountSummary[] }>
  bsAssets: Array<{ key: string; label: string; amount: number }>
  bsLiabilities: Array<{ key: string; label: string; amount: number }>
  bsEquity: Array<{ key: string; label: string; amount: number }>
  unmapped: AccountSummary[]
}

function applyTaxMapping(
  summary: AccountSummary[],
  netIncome: number,
): TaxStyledReport
```

- マッチング: `accounts[code]` を `taxMapping` の `accountCodes` または `codePrefix` と照合
- マッチしない expense 科目は `unmapped` に入る（UI で警告表示）
- B/S の `retainedEarnings` は集計 `netIncome` を持ってきて当期純利益として表示

---

## CSV エクスポート

### 弥生青色申告 標準仕訳形式（25列）

```csv
"識別フラグ","伝票No","決算","取引日付","借方勘定科目","借方補助科目","借方部門","借方税区分","借方金額","借方税金額","借方摘要","貸方勘定科目","貸方補助科目","貸方部門","貸方税区分","貸方金額","貸方税金額","貸方摘要","摘要","番号","期日","タイプ","生成元","仕訳メモ","付箋1","付箋2"
"2000","","","2026/06/20","売掛金","","","対象外",6000,0,"","売上高","","","対象外",6000,0,"","ご利用料金 山田太郎様","","","","","","",""
```

仕様簡略化:
- 借方1行 + 貸方1行のシンプル仕訳のみ前提
- 複合仕訳が来たら同じ伝票Noで複数行に分割
- 補助科目・部門・税金額は空欄、税区分は「対象外」（消費税未対応のため）
- 識別フラグは "2000"（仕訳）固定
- 取引日付フォーマット: `YYYY/MM/DD`
- 出力: **Shift_JIS** + CRLF

### freee 振替伝票 CSV 形式

```csv
"日付","取引内容","借方勘定科目","借方税区分","借方金額","貸方勘定科目","貸方税区分","貸方金額","管理番号","品目","部門","メモタグ","セグメント1","備考"
"2026-06-20","ご利用料金 山田太郎様","売掛金","対象外",6000,"売上高","対象外",6000,"","","","","",""
```

仕様簡略化:
- 日付: `YYYY-MM-DD`
- 税区分: 「対象外」固定
- 出力: **UTF-8 + BOM**（freee 推奨）

### 関数シグネチャ

```typescript
interface JournalForExport {
  entryDate: string         // YYYY-MM-DD
  description: string
  debitAccount: string
  debitAmount: number
  creditAccount: string
  creditAmount: number
}

function yayoiExport(rows: JournalForExport[]): string   // CSV 文字列（UTF-8）。Shift_JIS 変換は API 側
function freeeExport(rows: JournalForExport[]): string   // CSV 文字列（UTF-8 BOM 付き）
```

### CSV 共通

- フィールドにカンマ・改行・ダブルクオート含む → 全体を `"..."` で囲み、内側の `"` は `""` にエスケープ
- 空配列でもヘッダ行だけ返す

### API: `GET /api/admin/accounting/csv?format=yayoi|freee&year=2026&month=6`

- `month` 省略時は年次（1/1〜12/31）
- レスポンス:
  - 弥生: `Content-Type: text/csv; charset=shift_jis`、`Content-Disposition: attachment; filename="yayoi_2026_06.csv"`
  - freee: `Content-Type: text/csv; charset=utf-8`、`Content-Disposition: attachment; filename="freee_2026_06.csv"`
- Shift_JIS 変換は `iconv-lite` を使う

---

## UI

### ページ `/admin/accounting/report`

サイドバーの「🧮 会計」配下に新リンク「📊 決算書」を追加。

### 期間切替バー（sticky）

```
[年度: 2026 ▼]  [● 月次 ○ 年次]  [月: 6月 ▼]
                                    [📥 弥生CSV] [📥 freee CSV]
```

- 年度: プルダウン（過去5年〜来年）
- 集計単位: ラジオ（月次 / 年次）
- 月: 月次時のみ表示
- CSV ボタン: 現在の期間で即 DL

### P/L セクション

```
損益計算書（2026年6月）

売上（収入）金額        ¥420,000
仕入金額               −¥185,000
─────
差引金額                ¥235,000

経費
  給料賃金              ¥40,000
  水道光熱費            ¥18,500
  通信費                 ¥4,800
  消耗品費              ¥12,300
  福利厚生費             ¥6,500
  雑費                   ¥2,000
  ─────
  経費計                ¥84,100

所得金額               ¥150,900
```

- 未マッピング科目あれば上部に warn バナー
- v1 では数値クリックの内訳ドロワーは非対応（既存 `/admin/accounting/ledger` で総勘定元帳が見られるため代替可能、必要なら後付け）

### B/S セクション

```
貸借対照表（2026年6月末時点）

資産の部                  負債の部
  現金・預金 ¥385,000      買掛金   ¥45,000
  売掛金     ¥80,000      借入金 ¥500,000
  棚卸資産   ¥65,000      負債計  ¥545,000
  固定資産¥1,200,000
                         資本の部
                          元入金     ¥800,000
                          当期純利益 ¥385,000
  ─────                  資本計 ¥1,185,000
資産計 ¥1,730,000    負債・資本計 ¥1,730,000
```

- 左右並びは PC、スマホは縦並び（warm-* パレット、`max-w-md` カード）
- 借方 ≠ 貸方の場合 **赤字で警告**

### スマホ最適化

- 期間バー: 横スクロール
- P/L → B/S 縦並び
- 内訳ドロワーはモーダル

---

## エラー処理

| 場面 | 挙動 |
|------|------|
| journal_lines が期間内0件 | 「対象期間に取引がありません」、CSV ボタン disabled |
| マッピング外の expense 科目 | 上部 warn バナー「未分類: 名称(コード)」+ 「雑費」に集約 |
| accounts.normal_balance 不正値 | aggregatePeriod throw、API 500 |
| 借方≠貸方（B/S 一致しない）| UI で赤字警告、計算結果はそのまま表示 |
| CSV 特殊文字 | `"..."` でエスケープ |
| Shift_JIS 変換失敗 | API 500、ログ出力 |

---

## テスト戦略

### 純粋ロジック（vitest, TDD）

| ファイル | テスト件数 |
|------|------|
| `lib/accounting/__tests__/aggregatePeriod.test.ts`  | 6 |
| `lib/accounting/__tests__/applyTaxMapping.test.ts`  | 5 |
| `lib/accounting/__tests__/yayoiExport.test.ts`      | 4 |
| `lib/accounting/__tests__/freeeExport.test.ts`      | 4 |

詳細:
- aggregatePeriod: 単純集計 / 期間外除外 / B/S 累積 / normal_balance / 空配列 / ゼロ残高除外
- applyTaxMapping: 売上振り分け / 経費振り分け / 未マッピング→unmapped / codePrefix マッチ / B/S 振り分け
- yayoiExport: 1仕訳→1行 / 複数仕訳順序 / 特殊文字エスケープ / 空配列ヘッダのみ
- freeeExport: 同上、freee 列構成

### 統合系（手動）

| 確認項目 | 方法 |
|------|------|
| 画面表示 | `/admin/accounting/report?year=2026&month=6` で P/L・B/S 表示 |
| 内訳ドロワー | 数値タップで該当 accounts + 仕訳一覧表示 |
| 弥生 CSV DL | Excel で開いて文字化け無し |
| freee CSV DL | freee に取り込みテスト（オーナー実機）|
| 月次↔年次 切替 | UI 動作 |
| 取引0件期間 | 「取引なし」表示・ボタン disabled |
| 借方≠貸方 | 故意に不整合仕訳で警告色確認 |

**既存テスト総数**: 221 → 完了時 **240 件**（+19）

---

## 環境変数

新規不要。

---

## 後続

1〜2 期分のデータが溜まったら:
- 前月比・前年同月比の比較表示
- 部門別集計（売上/経費を部門軸で分割）
- 必要なら e-Tax XBRL 直接生成（実装大、後で判断）
