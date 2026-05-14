# @blueSky Phase 4 メール送信 設計ドキュメント

**日付:** 2026-05-13  
**スコープ:** 予約確認・キャンセル確認のトランザクションメール送信（React Email + Resend）

---

## 概要

Phase 3 で完成した予約フローとキャンセルフローに、自動メール送信を追加する。  
既存の Resend 設定（`RESEND_FROM_EMAIL` / `OWNER_EMAIL`）をそのまま使い、React Email でウォームトーンのHTMLメールを作成する。

---

## トリガーと送信先

| イベント | お客様へ | オーナーへ |
|----------|----------|-----------|
| 予約作成（`POST /api/reservations`） | 予約確認メール | 新規予約通知 |
| キャンセル（`POST /api/reservations/[id]/cancel`） | キャンセル確認メール | キャンセル通知 |

---

## メール仕様

### 1. お客様：予約確認メール（ReservationConfirm）

- **件名:** `【@blueSky】ご予約確認 - XXXXXXXX`（予約番号先頭8文字）
- **内容:**
  - ヘッダー：@blueSky ロゴ文字 + 「ご予約ありがとうございます」
  - 予約番号・ステータス（確認中）
  - チェックイン / チェックアウト日
  - 宿泊タイプ・オプション（サウナ・ペット・EHU・送迎）
  - 合計金額
  - 予約確認・キャンセルページへの直リンク（`/reserve/lookup/[UUID]`）
  - キャンセルポリシー要約（7日前無料・3〜6日前50%・前日当日100%）
  - フッター

### 2. オーナー：新規予約通知（ReservationNotify）

- **件名:** `【新規予約】XXXXXXXX - {guest_name} 様`
- **内容:**
  - 予約番号・チェックイン / チェックアウト
  - 宿泊タイプ・オプション全項目
  - お客様情報（名前・メール・電話）
  - 合計金額
  - 管理画面リンク（`/admin/reservations`）

### 3. お客様：キャンセル確認メール（CancellationConfirm）

- **件名:** `【@blueSky】キャンセル受付 - XXXXXXXX`
- **内容:**
  - キャンセル受付の旨
  - キャンセルした予約の概要（日程・宿泊タイプ）
  - キャンセル料（無料の場合は「無料」、有料の場合は金額と割合）
  - 「お支払いについては別途ご連絡します」の注記
  - 再予約リンク（`/reserve`）

### 4. オーナー：キャンセル通知（CancellationNotify）

- **件名:** `【キャンセル】XXXXXXXX - {guest_name} 様`
- **内容:**
  - キャンセルされた予約の全情報
  - キャンセル料（金額・割合・ラベル）
  - キャンセル日時

---

## ファイルマップ

```
emails/
├── ReservationConfirm.tsx    # お客様：予約確認（新規）
├── ReservationNotify.tsx     # オーナー：新規予約通知（新規）
├── CancellationConfirm.tsx   # お客様：キャンセル確認（新規）
└── CancellationNotify.tsx    # オーナー：キャンセル通知（新規）

lib/
└── email.ts                  # sendReservationEmails / sendCancellationEmails（新規）

app/api/reservations/
├── route.ts                  # 予約作成後にメール送信追加（修正）
└── [id]/cancel/route.ts      # キャンセル後にメール送信追加（修正）
```

---

## アーキテクチャ

### lib/email.ts

2つのヘルパー関数を export する。

```typescript
// 予約作成後に呼び出す（お客様＋オーナー 2通）
export async function sendReservationEmails(reservation: ReservationRow): Promise<void>

// キャンセル後に呼び出す（お客様＋オーナー 2通）
export async function sendCancellationEmails(
  reservation: ReservationRow,
  feeResult: CancellationFeeResult,
): Promise<void>
```

- 内部で `resend.emails.send()` を2回呼ぶ（並列 `Promise.all`）
- 失敗しても `console.error` のみ（予約・キャンセル処理には影響しない）

### API ルートの変更

**`app/api/reservations/route.ts`:**
```typescript
// reservation INSERT の後に追加
await sendReservationEmails(reservation).catch(console.error)
```

**`app/api/reservations/[id]/cancel/route.ts`:**
```typescript
// status 更新の後に追加
await sendCancellationEmails(reservation, feeResult).catch(console.error)
```

---

## デザイン仕様

- **カラー:** warm-600 相当（`#7c5c42`）をメインカラーとして使用
- **フォント:** システムフォント（sans-serif）
- **幅:** 600px 固定（メール標準）
- **スタイル:** `@react-email/components` の `Html`, `Body`, `Container`, `Heading`, `Text`, `Button`, `Hr`, `Section` を使用
- **ボタン:** `#a07050` 背景、白テキスト、角丸

---

## パッケージ

```bash
npm install react-email @react-email/components
```

---

## テスト方針

- メールテンプレートは UI ロジックのためユニットテスト対象外
- `lib/email.ts` のヘルパーは Resend をモックしてテストしない（ベストエフォート方針のため）
- 動作確認は `npm run dev` 環境で実際に予約・キャンセルを試し、受信トレイを確認する

---

## 環境変数（既存・追加不要）

| 変数 | 用途 |
|------|------|
| `RESEND_API_KEY` | Resend API 認証（既存） |
| `RESEND_FROM_EMAIL` | 送信元アドレス（既存） |
| `OWNER_EMAIL` | オーナー通知先（既存） |
| `NEXT_PUBLIC_SITE_URL` | メール内リンクのベースURL（新規追加） |

`NEXT_PUBLIC_SITE_URL` は `.env.local` に `http://localhost:3000`（開発）/ 本番URLを設定する。
