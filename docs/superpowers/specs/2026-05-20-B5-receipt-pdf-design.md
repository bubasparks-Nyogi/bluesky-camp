# サブプロジェクト B-5：領収書PDF＋お客様向け再ダウンロードページ 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 App Router / Supabase / TypeScript / TailwindCSS）
> 位置づけ: B-3（領収書メール）の発展。お客様が PDF を再取得できる仕組みを追加する。
> 後続: B-6（キャッシュレス決済）/ B-7（LINE 注文受付）

---

## B5-0. 範囲と方針

- PDF 生成は **`@react-pdf/renderer`**（サーバレス親和、軽量、JSX）。
- 認証は **予約ID＋メールアドレス照合**（既存 cancel と同じ作法）。
- 配信は **オンデマンド生成**（保存しない・常に最新の販売明細を反映）。
- メールは既存 B-3 のテンプレに「PDFダウンロード」ボタンを追加。送信履歴は `receipt_logs` を流用、変更なし。
- **再発行マーク**：`receipt_logs` の同 type 件数が1以上なら PDF タイトル横に「再発行」表記。
- 対象: 総合領収書 / キャンセル料明細書 の両方。

---

## B5-1. ゴール

メールのリンクから「予約番号＋メール」で照合 → 領収書一覧 → PDFをいつでもダウンロードできる。販売明細を後から編集しても、最新内容の PDF が即時生成される。送信済みの2回目以降は「再発行」マーク付き。

---

## B5-2. 全体フロー

```
[管理画面：手動/Cron送信] → メール（HTML本文 + 「PDFダウンロード」リンク）
                                ↓
お客様クリック → /receipts?id={予約ID}     ← 予約IDが自動入力済
                                ↓
お客様：メール入力 → [照合]
                                ↓
照合OK → 領収書一覧
                ・総合領収書 [PDFダウンロード]
                ・キャンセル料明細書 [PDFダウンロード]
                                ↓
DLボタン → /api/receipts/download?id=...&type=...&email=...
                                ↓
サーバ：再照合 → PDF オンデマンド生成
                → receipt_logs 同 type の件数チェック
                    ・1件以上 → isReissue=true → 「再発行」付き
                    ・0件 → 通常
                → application/pdf でストリーム返却
```

---

## B5-3. セキュリティ・照合

### 純粋関数 `matchReservation` (`lib/receipt/lookup.ts`)
```typescript
export function matchReservation(
  reservationId: string,
  email: string,
  reservation: { id: string; guest_email: string },
): boolean {
  if (!reservationId || !email) return false
  if (reservationId !== reservation.id) return false
  return reservation.guest_email.trim().toLowerCase() === email.trim().toLowerCase()
}
```

### 純粋関数 `determineIsReissue` (`lib/receipt/lookup.ts`)
```typescript
export function determineIsReissue(type: string, logs: { type: string }[]): boolean {
  return logs.filter(l => l.type === type).length >= 1
}
```

### `POST /api/receipts/lookup`（公開・admin認証なし）
入力: `{ reservationId: string; email: string }`
処理:
1. 空チェック → 400
2. `reservations` から id 一致を1件取得
3. `matchReservation()` で照合不一致 → **404**（既存 cancel と同じ「存在の手がかりを与えない」方針）
4. 一致 → 必要最小限の情報を返却:

```json
{
  "reservation": {
    "shortId": "ABCD1234",
    "checkinDate": "2026-08-15",
    "checkoutDate": "2026-08-17",
    "guestName": "山田 太郎"
  },
  "receipts": [
    { "type": "receipt",          "sentAt": "2026-08-17T10:23:00Z" },
    { "type": "cancellation_fee", "sentAt": "2026-08-14T09:00:00Z" }
  ]
}
```

`receipts` 配列は `receipt_logs` から `(type, sent_at)` を最新順で（同type複数あれば最新の1件のみ表示用）。

### `GET /api/receipts/download?id=...&type=...&email=...`（公開・PDFストリーム）
1. クエリ検証（id/type/email すべて必須、type は `'receipt' | 'cancellation_fee'`）
2. 予約取得 → `matchReservation()` 不一致 → 404
3. type 別にモデル組み立て:
   - `'receipt'`: `buildReceiptModel(reservation, pricing, saleLines, { isRepeater })` ※pricing と saleLines は DB 取得、isRepeater は B-3 と同じく `user_id` で判定
   - `'cancellation_fee'`: `calcCancellationFee(checkinDate, totalAmount)` → `buildCancellationFeeModel(reservation, fee, today)`
4. `isReissue = determineIsReissue(type, receiptLogs)`（同 type のログ件数で判定）
5. PDF 生成（`renderToBuffer`）
6. `Response` で `application/pdf` ストリーム返却
   - `Content-Disposition: attachment; filename="receipt-{shortId}.pdf"` または `cancellation-fee-{shortId}.pdf"`
7. **DL 時に `receipt_logs` には記録しない**（既存ログはメール送信のみの記録に保つ）

### サーバログ
- 失敗時のメールはマスク（`m***@gmail.com`）してログ。成功は記録しない。

---

## B5-4. PDF テンプレート（`lib/receipt/pdf/`）

### `styles.ts`
- A4・余白 50pt
- 色: warm-700 `#8a6e54` / warm-500 `#a16745` / red-500 `#dc2626` / green-600 `#16a34a`
- フォント: **Noto Sans JP**（日本語）。`@react-pdf/renderer` の `Font.register` で初回 DL→キャッシュ。
  - URL 例: `https://fonts.gstatic.com/s/notosansjp/...` の Regular / Bold 2 weight
- 共通 StyleSheet を export（タイトル、表行、合計行、再発行ラベル など）

### `ReceiptPdf.tsx`（総合領収書）
props: `{ model: ReceiptModel; isReissue: boolean; issuedAt: string }`

レイアウト（行ごとに簡潔に）:
- ヘッダ: 「@blueSky」「ご利用明細領収書」、右上に `isReissue` なら赤字「再発行」、発行日 `issuedAt`
- 宛名: `{guestName} 様`
- 利用日 / 予約番号
- **ご予約料金**: `reservationLines` を表で（label / amount）→ 小計 → 適用時 `リピーター割引 −10% −¥{repeaterDiscount}`
- **追加販売**: `saleLines.length > 0` のときのみ。`{date} {itemName} ¥{unitPrice} × {quantity}` → 販売小計
- **合計** ¥{grandTotal}（強調）
- フッタ: 「@blueSky」

### `CancellationFeePdf.tsx`（キャンセル料明細書）
props: `{ model: CancellationFeeModel; isReissue: boolean; issuedAt: string }`

レイアウト:
- ヘッダ: 「@blueSky」「キャンセル料明細書」、右上に `isReissue` なら赤字「再発行」、発行日
- 宛名: `{guestName} 様`
- 予約番号 / ご予約日程 / キャンセル日
- **キャンセル料**: 合計金額 / 適用率（feeLabel）
- **ご請求額** ¥{feeAmount}（強調・赤系）
- フッタ: 「お振込先・お問い合わせは下記までお願いします。」「@blueSky」

### `renderToBuffer.ts`
```typescript
import { renderToBuffer } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
export async function renderPdfToBuffer(doc: ReactElement): Promise<Buffer> {
  return await renderToBuffer(doc)
}
```

---

## B5-5. メール改修（B-3 既存テンプレに追記）

### `emails/ReceiptEmail.tsx`
合計行の下に `Section` 追加:
```tsx
<Section style={{ marginTop: 16, textAlign: 'center' }}>
  <a href={`${SITE_URL}/receipts?id=${reservationId}`}
     style={{ display: 'inline-block', padding: '10px 20px',
              backgroundColor: '#a16745', color: '#fff',
              textDecoration: 'none', borderRadius: '8px', fontSize: '14px' }}>
    📄 領収書PDFをダウンロード
  </a>
</Section>
```

`SITE_URL` は B-3 既存の `sendReceiptForReservation` から `model` 経由で受け取る（後述）。

### `emails/CancellationFeeReceipt.tsx`
同様に「ご請求額」の下に同じパターンで追加。

### モデル拡張（`lib/receipt/types.ts`）
- `ReceiptModel` に `reservationId: string`（フル UUID）を追加
- `CancellationFeeModel` に `reservationId: string` を追加

### `lib/receipt/build.ts`
- `buildReceiptModel`: 返却に `reservationId: reservation.id` を含める
- `buildCancellationFeeModel`: 返却に `reservationId: reservation.id` を含める

### `lib/receipt/sendReceipt.ts` / `cancelFeeHook.ts`
変更なし（model がそのままテンプレに渡る）。

### SITE_URL の参照
テンプレ内で参照する `SITE_URL` は環境変数 `NEXT_PUBLIC_SITE_URL` から既存パターンで取得（B-3 既存テンプレと同様）。

---

## B5-6. 公開ページ `/receipts`

### ファイル
```
app/receipts/
  page.tsx               ← Server Component。クエリ `id` を読み、Client にprops で渡す
  ReceiptLookupForm.tsx  ← Client。フォーム + 一覧 + DLリンク
```

### `page.tsx`
- `searchParams.id` を取得
- メタ: `title: '領収書ダウンロード | @blueSky'`、`robots: noindex`
- `<ReceiptLookupForm defaultReservationId={searchParams.id ?? ''} />` を render

### `ReceiptLookupForm.tsx`（Client）
状態:
- `reservationId` / `email` / `result`（照合API レスポンス）/ `error` / `loading`

UI:
1. **入力フォーム**（`result` が null のとき表示）
   - 予約番号（`defaultReservationId` 初期値・編集可）
   - ご登録メール
   - [ 領収書を表示 ] ボタン → `POST /api/receipts/lookup`

2. **領収書一覧**（`result` あり）
   - 予約情報サマリ（shortId / guestName / checkin〜checkout）
   - `result.receipts` 配列をループ:
     - type 別ラベル（'receipt' → 総合領収書、'cancellation_fee' → キャンセル料明細書）
     - 「最終送信 {sentAt の日本語フォーマット}」
     - 「PDFをダウンロード」リンク（`<a target="_blank">`）:
       `/api/receipts/download?id=${id}&type=${type}&email=${encodeURIComponent(email)}`
   - `receipts.length === 0` の場合: 「まだ領収書は発行されていません。チェックアウト後の発行をお待ちください。」
   - 末尾に小さく「※2回目以降のDLには「再発行」が記載されます」

エラー処理:
- 404 → 「予約番号またはメールアドレスが正しくありません」
- それ以外 → 「エラーが発生しました。時間をおいて再度お試しください」

---

## B5-7. 依存追加

`package.json`:
- `@react-pdf/renderer` を追加（dependencies）

---

## B5-8. テスト方針

| 対象 | ケース |
|------|--------|
| `matchReservation` | 一致でtrue / メール大文字混在でtrue / メール前後空白でtrue / id違いでfalse / メール違いでfalse / どちらか空でfalse |
| `determineIsReissue` | logs 0件→false / 1件以上→true / 別typeのみは false |

PDF テンプレ・API ルートはユニット対象外、本番で DL 動作確認。

---

## B5-9. ファイル構成（全体）

| ファイル | 種別 |
|---------|------|
| `lib/receipt/lookup.ts` | 新規（純粋）|
| `lib/receipt/__tests__/lookup.test.ts` | 新規 |
| `lib/receipt/pdf/styles.ts` | 新規 |
| `lib/receipt/pdf/ReceiptPdf.tsx` | 新規 |
| `lib/receipt/pdf/CancellationFeePdf.tsx` | 新規 |
| `lib/receipt/pdf/renderToBuffer.ts` | 新規 |
| `lib/receipt/types.ts` | 修正（reservationId追加）|
| `lib/receipt/build.ts` | 修正（reservationId 設定）|
| `app/api/receipts/lookup/route.ts` | 新規 |
| `app/api/receipts/download/route.ts` | 新規 |
| `app/receipts/page.tsx` | 新規 |
| `app/receipts/ReceiptLookupForm.tsx` | 新規 |
| `emails/ReceiptEmail.tsx` | 修正（DLボタン追加）|
| `emails/CancellationFeeReceipt.tsx` | 修正（DLボタン追加）|
| `package.json` | 修正 |

---

## B5-10. 申し送り
- **B-6**（決済）: 決済完了画面に同じ DL リンクを置けると UX 向上（将来検討）
- **B-7**（LINE）: PDFを LINE で送付（将来検討）

## B5-11. 非対象
- インボイス（適格請求書）対応
- レート制限の追加（Vercel デフォルト依存）
- PDF/A・電子帳簿保存法
- お客様による領収書の内容修正・再発行ワークフロー
- DL 履歴の保存（`receipt_logs` はメール送信のみの記録）
