# @blueSky Phase 5 Stripe Webhook 自動確定 設計ドキュメント

**日付:** 2026-05-15  
**スコープ:** Stripe Webhook による予約自動確定 + Stripe 未設定時の即時確定 + メール重複解消

---

## 概要

Phase 4 までで予約フロー・管理パネル・キャンセル・メール送信が完成した。  
現状 `status` は常に `pending` のままで、Stripe 決済完了後も `confirmed` にならない。  
Phase 5 では Stripe の有無に応じた自動確定フローを完成させ、メールの重複送信も解消する。

---

## 課題整理

| ケース | 現状 | 期待 |
|-------|------|------|
| Stripe 未設定 | 作成 → `pending` のまま | 作成 → 即時 `confirmed` |
| Stripe 設定済み | 作成 → `pending`、Webhook 未動作 | 作成 → `pending`、Webhook → `confirmed` |
| メール | Phase 4（作成時）+ notifications.ts（Webhook時）で二重送信 | Phase 4 テンプレートに統一 |

---

## フロー設計

### Stripe 未設定時（`stripeEnabled = false`）

```
予約フォーム送信
  → POST /api/reservations
  → status: 'confirmed' で INSERT
  → sendReservationEmails(reservation)  ← ステータス「確定」でメール送信
  → /reserve/complete へリダイレクト
```

### Stripe 設定済み時（`stripeEnabled = true`）

```
予約フォーム送信
  → POST /api/reservations
  → status: 'pending' で INSERT
  → sendReservationEmails(reservation)  ← ステータス「確認中・決済待ち」でメール送信
  → Stripe 決済画面

決済完了
  → POST /api/webhook/stripe
  → payment_intent.succeeded を受信
  → status: 'confirmed' に UPDATE
  → sendReservationConfirmedEmail(reservation)  ← ステータス「確定」でメール送信（ゲストのみ）
```

---

## 変更ファイル

```
app/api/reservations/route.ts           # status 分岐追加（修正）
app/api/webhook/stripe/route.ts         # Phase 4 テンプレート呼び出しに更新（修正）
emails/ReservationConfirm.tsx           # status プロップを動的化（修正）
lib/email.ts                            # sendReservationConfirmedEmail 追加 / status 対応（修正）
lib/notifications.ts                    # 旧メール削除・LINE 関数のみ残す（修正）
```

---

## 詳細仕様

### 1. `app/api/reservations/route.ts`

INSERT の `status` フィールドを分岐させる：

```typescript
status: stripeEnabled ? 'pending' : 'confirmed',
```

それ以外の変更なし。

### 2. `emails/ReservationConfirm.tsx`

`status` プロップを追加し、ステータス表示を動的にする：

```typescript
interface Props {
  // ...既存フィールド
  status: 'pending' | 'confirmed'  // ← 追加（'確認中' ハードコードを廃止）
}

// 表示テキスト
const STATUS_LABELS = { pending: '確認中（決済待ち）', confirmed: '確定' }
const STATUS_COLORS = { pending: '#d97706', confirmed: '#16a34a' }
```

Stripe 設定済みの `pending` メールには「決済完了後に確定メールをお送りします」の一文を追加。

### 3. `lib/email.ts`

#### 既存 `sendReservationEmails` の変更

`status` を引数として受け取り、テンプレートに渡す：

```typescript
export async function sendReservationEmails(
  r: ReservationEmailData,
  status: 'pending' | 'confirmed' = 'pending',
): Promise<void>
```

#### 新規 `sendReservationConfirmedEmail`

Webhook 専用。ゲストへの「確定」メール 1 通のみ送信：

```typescript
export async function sendReservationConfirmedEmail(
  r: ReservationEmailData,
): Promise<void>
```

内部で `sendReservationEmails(r, 'confirmed')` のゲスト分だけ呼ぶ。  
オーナーへの再通知は不要（作成時に送信済み）。

### 4. `app/api/webhook/stripe/route.ts`

```typescript
import { sendReservationConfirmedEmail } from '@/lib/email'

// payment_intent.succeeded
const { data: reservation } = await supabaseAdmin
  .from('reservations')
  .update({ status: 'confirmed' })
  .eq('stripe_payment_id', pi.id)
  .select('...')  // メール送信に必要な全フィールド
  .single()

if (reservation) {
  sendReservationConfirmedEmail(reservation).catch(console.error)
}
```

`sendReservationNotifications`（旧）の呼び出しを削除。

### 5. `lib/notifications.ts`

- `sendReservationNotifications` を削除
- `sendGuestEmail` / `sendGuestLine` / `sendOwnerLine` を整理
- LINE Push API ラッパー（`lineReply`）は将来の LINE 通知フェーズ用として残す

---

## メール件名・文言

| タイミング | 件名 | ステータス表示 |
|-----------|------|--------------|
| 作成時（Stripe なし） | 【@blueSky】ご予約確認 - XXXXXXXX | ✅ 確定 |
| 作成時（Stripe あり） | 【@blueSky】ご予約受付 - XXXXXXXX | ⏳ 確認中（決済待ち） |
| 決済完了時（Stripe あり） | 【@blueSky】ご予約確定 - XXXXXXXX | ✅ 確定 |

---

## 環境変数（既存・追加なし）

| 変数 | 用途 |
|------|------|
| `STRIPE_SECRET_KEY` | Stripe API 認証（placeholder で無効化） |
| `STRIPE_WEBHOOK_SECRET` | Webhook 署名検証（`whsec_...`） |

ローカル開発での Webhook テストは Stripe CLI を使用：
```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

---

## テスト方針

- `lib/email.ts` の `sendReservationConfirmedEmail` はモックなしでテストしない（ベストエフォート）
- `app/api/reservations/route.ts` の `status` 分岐は既存の単体テストで確認
- Stripe Webhook の動作確認は Stripe CLI でローカルテスト
