# 会計システム サブプロジェクトC：経費入力＋レシートOCR 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 App Router / Supabase / TypeScript / TailwindCSS）
> 前提: サブプロジェクトA（複式簿記コア）・B（売上連携）完了済み。本書は経費の証憑付き記帳を支援する **C：レシートOCR** の設計。

---

## C-0. 全体方針の再掲・C固有の決定

- 全体方針（A-0）: 個人事業主・青色申告65万円控除、当面免税、e-Tax直接送信なし
- C は **レシートOCR専用**。手入力の経費は既存の仕訳帳（A）で行う（重複を作らない）
- OCRエンジン: **Anthropic Claude（Sonnet系・画像対応）**。要 `ANTHROPIC_API_KEY`
- レシート画像は **Supabase Storage（非公開バケット `receipts`）** に保存し、経費仕訳に紐付け（証憑保存）
- 支払元（貸方）は確認画面のプルダウンで選択し、**前回選んだ科目を localStorage に記憶**して次回初期選択
- OCRはあくまで補助。**失敗しても手入力で経費を登録できる**

---

## C-1. ゴール

レシートを撮影/選択すると、Claude が日付・金額・店名・推定費用科目を読み取って下書きを作り、人が確認・修正して「記帳」すると、証憑画像付きの経費仕訳（借 費用科目 / 貸 支払元）が複式簿記に登録される。

---

## C-2. データモデル

会計テーブルは最小追加。画像保存先バケットを用意。

### ① `journal_entries` に証憑リンク（マイグレーション `011_journal_receipt.sql`）
```sql
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS receipt_url text;
```
- 経費仕訳にレシート画像の保存パスを保持
- 経費仕訳は `source='expense'`（手入力='manual'、予約='reservation' と区別）

### ② Supabase Storage バケット `receipts`（手動作成）
- **非公開**（公開写真の `photos` とは分離）
- サーバ側（service role）でアップロード、表示時は署名付きURLを発行
- 保存パス: `{YYYYMM}/{uuid}.{ext}`（バケット内）

### ③ 支払元デフォルトの記憶
- ブラウザ localStorage キー `expense_last_credit_account` に、前回選んだ支払元の account_id を保存。確認画面で初期選択に使用。サーバ設定は持たない

---

## C-3. OCRフロー

```
画像選択/撮影
  → POST /api/admin/accounting/ocr-receipt（multipart）
  → サーバ: receipts バケットに保存 → Anthropic（Sonnet・画像）でOCR
  → parseOcrResult で正規化した draft と receiptPath を返す
  → 確認フォーム（下書きを初期値に編集可）
  → POST /api/admin/accounting/post-expense → 経費仕訳生成
```

### OCR抽出項目（下書き `OcrDraft`）
| 項目 | 型 | 内容 |
|------|----|----|
| `date` | string | 利用日 YYYY-MM-DD（読めなければ ''）|
| `amount` | number | 合計金額（整数・円。読めなければ 0）|
| `vendor` | string | 店名（→摘要。読めなければ ''）|
| `suggestedAccountCode` | string | 推定費用科目コード（候補に無ければ ''）|
| `confidence` | 'low'\|'medium'\|'high'\|'' | 自信度（任意）|

### モデルへの指示方針
- システムプロンプト: 「日本のレシート画像から日付・合計金額・店名・最適な費用科目コードを **JSONのみ** で返す」
- ユーザーメッセージに **費用科目の候補リスト**（科目マスタ `category='expense'` の code+name）を列挙し、その中から `suggestedAccountCode` を選ばせる
- モデル応答を `parseOcrResult()` で検証・正規化（候補外コードやJSON崩れは空にフォールバック、例外を投げない）

### モデル指定
- `ANTHROPIC_API_KEY` を用い、サーバ側で Anthropic Messages API（vision）を呼ぶ。モデルは Sonnet 系（実装時の最新安定 Sonnet を `lib/ocrConfig.ts` 等で定数化し差し替え可能に）

---

## C-4. 純粋ロジック（`lib/accounting/ocrReceipt.ts`・テスト対象）

### 型
```typescript
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
  debitAccountId: string   // 費用科目
  creditAccountId: string  // 支払元
}
```

### `parseOcrResult(raw: string, validExpenseCodes: string[]): OcrDraft`
- `raw`（モデル応答）から JSON を抽出（```json フェンスや前後テキストを許容）。失敗時は全項目空の `OcrDraft`
- `amount`: 文字列なら「¥」「,」「円」「空白」を除去して整数化。整数でなければ 0
- `date`: `YYYY-MM-DD` 形式に合致しなければ ''
- `suggestedAccountCode`: `validExpenseCodes` に含まれなければ ''
- `vendor`: 文字列でなければ ''
- 例外を投げない

### `buildExpenseEntry(input: ExpenseInput): JournalEntryInput`（throw on invalid）
- `amount` が正の整数でなければ `Error('金額は正の整数で入力してください')`
- `debitAccountId === creditAccountId` なら `Error('借方と貸方に同じ科目は指定できません')`
- それ以外: 
  ```
  { entryDate: date,
    description: description || '経費',
    lines: [
      { accountId: debitAccountId,  side: 'debit',  amount },
      { accountId: creditAccountId, side: 'credit', amount },
    ] }
  ```
- 生成結果は `validateEntry()` を通る（借貸一致）

---

## C-5. API（admin 認証必須）

### `POST /api/admin/accounting/ocr-receipt`（multipart/form-data）
1. admin 認証（401）
2. `ANTHROPIC_API_KEY` 未設定 → `{ error: 'OCRは未設定です。手入力をご利用ください' }`（400）
3. 画像取得。10MB 超 → 413
4. `receipts` バケットに `{YYYYMM}/{uuid}.{ext}` で保存（service role）
5. 科目マスタから費用科目候補（code+name）取得 → プロンプト構築
6. Anthropic（Sonnet・vision）呼び出し → 応答テキスト
7. `parseOcrResult(text, validCodes)` で下書き化
8. 返却: `{ draft, receiptPath }`
9. OCR呼び出し自体が失敗 → 全項目空の draft ＋ receiptPath を返す（画像は保存済み・手入力で続行可能）

### `POST /api/admin/accounting/post-expense`（JSON）
入力: `{ date, amount, description, debitAccountId, creditAccountId, receiptPath }`
1. admin 認証（401）
2. `buildExpenseEntry()` で仕訳生成（throw → 400 でエラーメッセージ）
3. 借方・貸方の account_id が実在するか確認（無ければ 400）
4. `validateEntry()` 通過後、`journal_entries`（source='expense', receipt_url=receiptPath）＋ `journal_lines` を保存（A の挿入パターン・ロールバック付き）
5. 返却: `{ entryId }`

### `GET /api/admin/accounting/receipt-url?path=...`（署名付きURL発行）
- admin 認証。`receipts` バケットの指定パスに対する署名付きURL（短期）を返す。仕訳からレシートを表示する用途

---

## C-6. UI

### 「レシート経費入力」ページ（新規）
- パス: `app/admin/(dashboard)/accounting/expense/page.tsx`（Server Component で費用科目・支払元候補を取得しクライアントへ）
- 会計トップ `app/admin/(dashboard)/accounting/page.tsx` の `LINKS` に「🧾 レシート経費入力」追加

### クライアント `ExpenseReceptForm`（`components/admin/accounting/ExpenseReceiptForm.tsx`）
1. `<input type="file" accept="image/*" capture>` で画像選択/撮影＋プレビュー
2. 「読み取る」→ `/api/admin/accounting/ocr-receipt`（ローディング表示）
3. 確認フォーム（OCR下書き初期値・全項目編集可）:
   - 日付（date）/ 金額（number）/ 摘要（text, 店名初期値）
   - 借方＝費用科目プルダウン（費用科目のみ、OCR推定を初期選択）
   - 貸方＝支払元プルダウン（現金/普通預金/未払金/事業主借、localStorage の前回値を初期選択）
   - レシート画像プレビュー
4. 「この内容で記帳」→ `/api/admin/accounting/post-expense`。成功で支払元を localStorage に保存、フォームをリセットして次のレシートへ
5. OCR失敗時は「読み取れませんでした。手で入力してください」＋空フォーム

### 支払元プルダウンの選択肢
科目マスタから code ∈ {101現金, 102普通預金, 202未払金, 303事業主借} を取得して提示（無効化されていれば除外）。

---

## C-7. エラー処理・セキュリティ

- `ANTHROPIC_API_KEY` はサーバ専用。未設定時は OCR を明示エラーにし手入力フォールバック
- 画像サイズ上限 10MB（超過 413）。OCR前にサーバでチェック
- OCR失敗/不正JSON → 空下書きで確認フォームを開く（経費登録は継続可能）
- `receipts` バケットは非公開。アップロードは service role、表示は署名付きURL（admin認証済みページ経由のみ）
- 金額は正の整数（`buildExpenseEntry` で検証）、借貸一致（`validateEntry`）、借方≠貸方
- 冪等性は付けない（送信ごと1仕訳）。誤登録は仕訳帳から削除（運用手順書に記載）

---

## C-8. テスト方針

| 対象 | ケース |
|------|--------|
| `parseOcrResult` | 正常JSON抽出 / 金額の「¥・,・円」除去→整数 / 不正日付→'' / 候補外科目→'' / 壊れJSON→全項目空（例外なし）/ ```json フェンス付き応答の抽出 |
| `buildExpenseEntry` | 正常（借費用/貸支払元・`validateEntry`通過）/ 金額0・負→throw / 借==貸→throw |

OCR API・Storage・署名付きURL は外部依存のためユニットテストせず手動確認。API ルートは既存 admin パターン準拠。E2E は後続とまとめて。

---

## C-9. 触る/新規ファイル

| ファイル | 種別 |
|---------|------|
| `supabase/migrations/011_journal_receipt.sql` | 新規（receipt_url）|
| `lib/accounting/ocrReceipt.ts` | 新規（parseOcrResult / buildExpenseEntry / 型）|
| `lib/accounting/__tests__/ocrReceipt.test.ts` | 新規（テスト）|
| `lib/ocrConfig.ts` | 新規（モデル名定数）|
| `app/api/admin/accounting/ocr-receipt/route.ts` | 新規 |
| `app/api/admin/accounting/post-expense/route.ts` | 新規 |
| `app/api/admin/accounting/receipt-url/route.ts` | 新規 |
| `components/admin/accounting/ExpenseReceiptForm.tsx` | 新規 |
| `app/admin/(dashboard)/accounting/expense/page.tsx` | 新規 |
| `app/admin/(dashboard)/accounting/page.tsx` | 修正（LINKS追加）|
| Supabase Storage バケット `receipts` | 手動作成（非公開）|
| `@anthropic-ai/sdk` | npm 追加 |

---

## C-10. 非対象

- 手入力の経費フォーム（既存の仕訳帳で対応）
- レシートからの明細分解（合計金額のみ。品目別の按分はしない）
- 経費の重複検知・冪等化
- 消費税の区分（当面免税）
- 固定資産（→ D）・決算書（→ E）
