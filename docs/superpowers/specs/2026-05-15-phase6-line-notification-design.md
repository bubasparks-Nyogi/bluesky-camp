# @blueSky Phase 6 LINE オーナー通知 設計ドキュメント

**日付:** 2026-05-15  
**スコープ:** 予約確定時にオーナーへ LINE Push 通知を送信する

---

## 概要

Phase 5 までで予約確定フロー・メール通知が完成した。  
Phase 6 では、予約が確定したタイミングでオーナーの LINE にリアルタイム通知を送る。  
ゲストへの確定メールはすでに Phase 5 で送信しているため、LINE はオーナー専用通知として位置づける。

---

## 課題整理

| ケース | 現状 | 期待 |
|-------|------|------|
| Stripe 設定済み・決済完了 | オーナーへメール通知のみ | メール＋ LINE 通知 |
| Stripe 未設定・即時確定 | オーナーへメール通知のみ | メール＋ LINE 通知 |
| `OWNER_LINE_USER_ID` 未設定 | — | 静かにスキップ（エラーなし） |

---

## フロー設計

### Stripe 設定済み時

```
決済完了
  → POST /api/webhook/stripe
  → status: 'confirmed' に UPDATE
  → sendReservationConfirmedEmail(reservation)   ← ゲストへメール（既存）
  → sendOwnerLineNotification(reservation)        ← オーナーへ LINE（新規）
```

### Stripe 未設定時（即時確定）

```
予約フォーム送信
  → POST /api/reservations
  → status: 'confirmed' で INSERT
  → sendReservationEmails(reservation, 'confirmed')  ← ゲスト＋オーナーへメール（既存）
  → sendOwnerLineNotification(reservation)            ← オーナーへ LINE（新規）
```

---

## 変更ファイル

```
lib/notifications.ts            # sendOwnerLineNotification を追加（修正）
lib/notifications.test.ts       # 新関数のテスト追加（修正）
app/api/webhook/stripe/route.ts # sendOwnerLineNotification 呼び出し追加（修正）
app/api/reservations/route.ts   # Stripe 無効時に sendOwnerLineNotification 呼び出し追加（修正）
```

---

## 詳細仕様

### 1. `lib/notifications.ts`

`sendOwnerLineNotification` を追加する:

```typescript
export async function sendOwnerLineNotification(r: {
  guest_name:   string
  checkin_date: string
  stay_type:    string
  total_amount: number
}): Promise<void> {
  const userId = process.env.OWNER_LINE_USER_ID
  if (!userId) return   // 未設定なら静かにスキップ

  const text = `【予約確定】${r.guest_name} 様\n📅 ${r.checkin_date}\n🏕 ${r.stay_type}\n💴 ¥${r.total_amount.toLocaleString()}`
  await lineReply(userId, text)
}
```

### 2. `lib/notifications.test.ts`

`sendOwnerLineNotification` のテストを追加:

- `OWNER_LINE_USER_ID` が設定されている場合 → `lineReply` が呼ばれること
- `OWNER_LINE_USER_ID` が未設定の場合 → `lineReply` が呼ばれないこと（スキップ）

### 3. `app/api/webhook/stripe/route.ts`

`sendReservationConfirmedEmail` の直後にベストエフォートで追加:

```typescript
sendReservationConfirmedEmail(reservation).catch(console.error)
sendOwnerLineNotification(reservation).catch(console.error)   // ← 追加
```

### 4. `app/api/reservations/route.ts`

`stripeEnabled` が `false` のとき（即時確定パス）のみ追加:

```typescript
sendReservationEmails(
  reservation,
  stripeEnabled ? 'pending' : 'confirmed',
).catch(console.error)

if (!stripeEnabled) {
  sendOwnerLineNotification(reservation).catch(console.error)  // ← 追加
}
```

---

## LINE メッセージ形式

```
【予約確定】山田 太郎 様
📅 2026-07-01
🏕 trailer_a
💴 ¥25,000
```

---

## 環境変数

| 変数 | 用途 |
|------|------|
| `OWNER_LINE_USER_ID` | オーナーの LINE ユーザーID（未設定時は通知スキップ） |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API チャネルアクセストークン（既存） |

---

## テスト方針

- `sendOwnerLineNotification` のユニットテスト（`fetch` モック）
  - `OWNER_LINE_USER_ID` 設定時: `lineReply` が正しい引数で呼ばれること
  - `OWNER_LINE_USER_ID` 未設定時: `lineReply` が呼ばれないこと
- Webhook・reservations ルートの既存テストが引き続きパスすること

---

## 非スコープ

- ゲストへの LINE 通知（将来フェーズ）
- LINE Login / OAuth によるゲスト LINE ID 収集
- キャンセル時の LINE 通知
