# サブプロジェクト B-3：お客様向け明細領収書 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 App Router / Supabase / TypeScript / TailwindCSS / Gmail SMTP / React Email）
> 位置づけ: 予約に紐づく販売明細を登録し、予約料金＋販売明細を合算した総合領収書 / キャンセル料明細書をお客様にメールで送る。
> 全体の流れ: B-1（品目）→ B-2（在庫）→ **B-3（領収書メール）** → B-4（売上原価の会計連携）→ B-5（PDF＋お客様DLページ・新規）。

---

## B3-0. 範囲と方針

- 販売明細は予約に紐づく `sale_lines` で1行ずつ管理。**品目名と単価はスナップショット**で保持（マスタ変更で過去領収書が変わらない）。
- 総合領収書 = 予約料金内訳（既存 `calcBreakdown`）＋ リピーター割引行（適用時）＋ 販売明細＋ 合計。
- 自動送信 ＋ 手動再送（領収書）。キャンセル料明細書はキャンセルフックから自動送信。
- 送信履歴は `receipt_logs` で冪等管理。**送信トランスポートは既存の `lib/mailer.ts`（Gmail SMTP）を再利用**。
- メールは **HTML のみ**。PDF・お客様向け再ダウンロードページは **B-5（別途）**。販売消費による在庫減/原価仕訳は **B-4（別途）**。

---

## B3-1. ゴール

予約詳細画面で滞在中の販売を1行ずつ登録でき、チェックアウト後に総合領収書がお客様へ自動送信される（手動再送も可）。キャンセル時はキャンセル料明細書が自動送信される。送信は冪等で、再送はログを追加するだけ。

---

## B3-2. データモデル（マイグレーション `014_sale_lines.sql`）

### ① `sale_lines`（販売明細）
```sql
CREATE TABLE sale_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL REFERENCES items(id),
  item_name      text NOT NULL,        -- スナップショット
  unit_price     integer NOT NULL,     -- スナップショット（円）
  quantity       numeric NOT NULL CHECK (quantity > 0),
  occurred_at    date NOT NULL,
  note           text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_sale_lines_reservation ON sale_lines (reservation_id);
ALTER TABLE sale_lines ENABLE ROW LEVEL SECURITY;
```

### ② `receipt_logs`（送信履歴・冪等）
```sql
CREATE TABLE receipt_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  type           text NOT NULL,        -- 'receipt' | 'cancellation_fee'
  sent_to        text NOT NULL,
  total_amount   integer NOT NULL,
  trigger        text NOT NULL,        -- 'auto' | 'manual'
  sent_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_receipt_logs_reservation ON receipt_logs (reservation_id, type);
ALTER TABLE receipt_logs ENABLE ROW LEVEL SECURITY;
```

判定: 「ある予約に同 type のログが既にあるか」で送信済みを判定。**手動再送はログを追加**し、自動送信は既存ログがあればスキップ。

---

## B3-3. 純粋ロジック（`lib/receipt/`・テスト対象）

### 型 `lib/receipt/types.ts`
```typescript
export interface ReceiptLine {
  label: string
  amount: number       // 行金額（整数・円）
}

export interface ReceiptModel {
  guestName: string
  reservationShortId: string  // 予約ID先頭8文字を大文字
  checkinDate: string
  checkoutDate: string
  nights: number              // 0 以上の整数
  reservationLines: ReceiptLine[]   // calcBreakdown 由来
  reservationSubtotal: number       // 予約料金の小計（割引前）
  repeaterDiscount: number          // 0 のとき非表示
  saleLines: { date: string; itemName: string; unitPrice: number; quantity: number; amount: number }[]
  salesSubtotal: number
  grandTotal: number                // 最終合計（予約小計 − 割引 + 販売小計）
}

export interface CancellationFeeModel {
  guestName: string
  reservationShortId: string
  checkinDate: string
  checkoutDate: string
  cancelledAt: string
  totalAmount: number   // 予約合計（割引適用後）
  feeRate: number       // 0/50/100 等
  feeAmount: number
  feeLabel: string      // 例 "合計金額の50%"
}
```

### `buildReceiptModel(reservation, pricing, saleLines, options): ReceiptModel`（`lib/receipt/build.ts`）
入力:
- `reservation`: ReservationRow（既存）
- `pricing`: PricingItem[]
- `saleLines`: `sale_lines` の行（snake_case）
- `options`: `{ isRepeater?: boolean }`（DBの履歴から判定して呼び出し元が渡す）

ロジック:
1. `calcBreakdown(form, pricing)` で予約料金の行を取得 → `reservationLines`。
2. `reservationSubtotal` = 行の合計（割引前）。
3. `repeaterDiscount` = `isRepeater === true` のとき `reservationSubtotal - Math.floor(reservationSubtotal * 0.9)`、それ以外 0。
4. `saleLines` を `{ date, itemName, unitPrice, quantity, amount }` に整形（amount = unitPrice × quantity を四捨五入の整数）。
5. `salesSubtotal` = `saleLines.amount` の合計。
6. `grandTotal` = `reservationSubtotal − repeaterDiscount + salesSubtotal`。
7. `reservationShortId` = id 先頭8文字を大文字。`nights` = `calcNights(checkin, checkout)`。

### `buildCancellationFeeModel(reservation, fee): CancellationFeeModel`（`lib/receipt/build.ts`）
入力:
- `reservation`: ReservationRow
- `fee`: `calcCancellationFee()` の結果 `{ fee, rate, label }`

ロジック:
- `feeAmount` = fee.fee、`feeRate` = fee.rate、`feeLabel` = fee.label。
- `cancelledAt` = 呼び出し元から渡された日付（fallback: 今日の YYYY-MM-DD）。

---

## B3-4. メールテンプレート（React Email）

### `emails/ReceiptEmail.tsx`
- `ReceiptModel` を props で受け取り、HTML を組む。
- セクション構成:
  1. ヘッダ（@blueSky ご利用ありがとうございました）
  2. ゲスト名・利用日（チェックイン〜チェックアウト、N泊）・予約番号
  3. 【ご予約料金】 — `reservationLines` を表として描画。最下行に小計、適用時に `リピーター割引 −10%` 行（金額は `-repeaterDiscount`）。
  4. 【追加販売】 — `saleLines` がある場合のみセクション表示。日付・品目名・単価×数量・小計。最下行に「販売小計」。
  5. 合計（grandTotal）— 強調表示。
- 件名: `【@blueSky】ご利用明細領収書 - {reservationShortId}`

### `emails/CancellationFeeReceipt.tsx`
- `CancellationFeeModel` を props で受け取る。
- セクション:
  1. ヘッダ（キャンセル料のご案内）
  2. ゲスト名・予約番号・ご予約日程・キャンセル日
  3. 【キャンセル料】 — 合計金額 / 適用率（feeLabel）/ ご請求額（feeAmount）
  4. お振込先・問い合わせ案内（固定文）
- 件名: `【@blueSky】キャンセル料明細書 - {reservationShortId}`

---

## B3-5. API（admin 認証 `getUser()` ＋ `supabaseAdmin`）

### 販売明細
| ルート | メソッド | 内容 |
|--------|---------|------|
| `/api/admin/reservations/[id]/sale-lines` | GET | 予約の販売明細一覧（occurred_at 昇順）|
| | POST | 追加。`{ itemId, quantity, occurredAt, note? }`。サーバで `items` から `name`/`sale_price` を取得して `item_name`/`unit_price` をスナップショット。`is_sellable=false` は 400 |
| `/api/admin/reservations/[id]/sale-lines/[lineId]` | DELETE | 削除 |

### 領収書送信（手動再送）
| ルート | メソッド | 内容 |
|--------|---------|------|
| `/api/admin/reservations/[id]/send-receipt` | POST | 領収書を組み立てて送信、`receipt_logs` に `trigger='manual'` を追加。冪等チェックなし（再送可）|

### 自動送信 (Cron)
| ルート | メソッド | 内容 |
|--------|---------|------|
| `/api/cron/send-receipts` | GET | `Authorization: Bearer ${CRON_SECRET}` 検証。`status='confirmed'` ＆ `checkout_date < today` ＆ `receipt_logs` に `type='receipt'` なしの予約をスキャン → 各送信＋ `trigger='auto'` でログ。失敗は記録し継続。`{ scanned, sent, skipped, failed }` を返す |

`vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/send-receipts", "schedule": "0 0 * * *" }] }
```
（UTC 00:00 = JST 09:00 に毎日実行）

### キャンセル料明細書フック（既存ルート修正）
- `app/api/reservations/[id]/cancel/route.ts`：既存のキャンセル後フックの直後に呼ぶ
- `app/api/admin/reservations/[id]/status/route.ts`：`status === 'cancelled'` のブロックで呼ぶ
- 共通フック `lib/receipt/cancelFeeHook.ts` に集約。条件: `receipt_logs` に `type='cancellation_fee'` 無 ＆ `fee.fee > 0`。送信＋ログ追加。失敗は best-effort（既存パターン踏襲）。

### 送信トランスポート
- 既存 `lib/mailer.ts` の `sendMail({ to, subject, html })` を使用。
- `lib/email.ts` に `sendReceiptEmail(model, to)` / `sendCancellationFeeEmail(model, to)` を追加し、`render(<ReceiptEmail .../>)` / `render(<CancellationFeeReceipt .../>)` で HTML を生成 → sendMail。
- **送信は必ず `await`**（既存 reservations POST と同じく、サーバレスの投げっぱなし対策で C-mail 修正済みの方針を踏襲）。

---

## B3-6. UI（販売明細セクション）

- パス: `app/admin/(dashboard)/reservations/[id]/page.tsx`（既存）に **販売明細セクション**を追加。
- クライアント `components/admin/sales/SaleLinesEditor.tsx`:
  - 一覧（日付・品目名・単価・数量・小計・削除ボタン）。最下行に販売小計。
  - 追加フォーム: 日付（既定=今日）・品目プルダウン（`is_sellable=true` の品目）・数量・メモ。品目選択時に単価をプレビュー表示。
  - 「**領収書を送信** / **領収書を再送信**」ボタン。`receipt_logs` の有無で表記切替＋送信済みなら最終送信日時を下に小さく表示。
- サーバページ側で `sale_lines` ＋ `receipt_logs` を取得し、`SaleLinesEditor` に渡す。
- 販売明細を変更しても**自動送信は再発火しない**（手動再送が前提）。

---

## B3-7. テスト方針

| 対象 | ケース |
|------|--------|
| `buildReceiptModel` | 予約料金行 + 販売明細 + 合計が正しい / 販売ゼロでも料金行だけで成立 / `isRepeater=true` で割引行と合計が反映 / `isRepeater=false` で割引行なし |
| `buildCancellationFeeModel` | 合計・適用率・請求額が正しく組まれる |

API・メール送信・テンプレート HTML は外部依存のためユニットテストせず、本番で実送信確認。

---

## B3-8. ファイル構成

| ファイル | 種別 |
|---------|------|
| `supabase/migrations/014_sale_lines.sql` | 新規 |
| `lib/receipt/types.ts` / `build.ts` | 新規 |
| `lib/receipt/__tests__/build.test.ts` | 新規 |
| `lib/receipt/cancelFeeHook.ts` | 新規（キャンセル料フック共通）|
| `lib/email.ts` | 修正（`sendReceiptEmail` / `sendCancellationFeeEmail` 追加）|
| `emails/ReceiptEmail.tsx` | 新規 |
| `emails/CancellationFeeReceipt.tsx` | 新規 |
| `app/api/admin/reservations/[id]/sale-lines/route.ts` | 新規 |
| `app/api/admin/reservations/[id]/sale-lines/[lineId]/route.ts` | 新規 |
| `app/api/admin/reservations/[id]/send-receipt/route.ts` | 新規 |
| `app/api/cron/send-receipts/route.ts` | 新規 |
| `app/api/reservations/[id]/cancel/route.ts` | 修正（cancelFeeHook 呼び出し）|
| `app/api/admin/reservations/[id]/status/route.ts` | 修正（同上）|
| `components/admin/sales/SaleLinesEditor.tsx` | 新規 |
| `app/admin/(dashboard)/reservations/[id]/page.tsx` | 修正（販売明細セクション組込）|
| `vercel.json` | 修正（cron 追加）|

---

## B3-9. 環境変数（追加）
| 変数 | 用途 |
|------|------|
| `CRON_SECRET` | Vercel Cron の `Authorization: Bearer` 検証用（Vercel が自動付与または手動設定）|

---

## B3-10. 申し送り（後続へ）

- **B-4（売上原価の会計連携）**: `sale_lines` 追加時に **レシピ展開**（`item_components`）で食材在庫を自動消費する（`stock_movements` type='consume' を追加）＋ 売上原価仕訳。本書ではフックを置かない（B-4 で `sale_lines` の INSERT 後処理を実装）。
- **B-5（PDF＋お客様DL）**:
  - PDF出力（HTMLメール→PDF添付 or 単独ダウンロード）
  - お客様自身が領収書を再取得できるページ（URL に短期トークンを付与など）
  - 本書では非対象。B-5 のスコープは別途設計する。
- B-1/B-2 と同様、本書で扱う数量・金額は整数（円）と小数（quantity）を厳密に扱う。

## B3-11. 非対象
- インボイス（適格請求書）対応・消費税区分（免税前提）
- PDF出力（→ B-5）
- お客様向け再ダウンロードページ（→ B-5）
- 販売消費による在庫減・原価仕訳（→ B-4）
