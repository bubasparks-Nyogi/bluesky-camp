# @blueSky Phase 7 予約確認UX改善 設計ドキュメント

**日付:** 2026-05-15  
**スコープ:** ① 予約完了後の直接遷移 ② 詳細ページの表示改善 ③ キャンセル後のアクション追加

---

## 概要

Phase 6 までで予約・決済・通知フローが完成した。  
Phase 7 では予約完了後・キャンセル後のゲスト体験を改善する。

---

## 変更①：予約完了後に `/reserve/lookup/{id}` へ直接遷移

### 現状

`StepPayment.tsx` が `/reserve/complete?id={id}` にリダイレクトしている。

- Stripe 未設定: `window.location.href = '/reserve/complete?id=${data.reservationId}'`
- Stripe あり: `return_url: '${window.location.origin}/reserve/complete?id=${reservationId}'`

### 変更後

両パスのリダイレクト先を `/reserve/lookup/{reservationId}` に変更する。  
`/reserve/complete/page.tsx` は不要になるため削除する。

```typescript
// Stripe 未設定パス
window.location.href = `/reserve/lookup/${data.reservationId}`

// Stripe ありパス（confirmParams）
return_url: `${window.location.origin}/reserve/lookup/${reservationId}`
```

---

## 変更②：予約詳細ページの表示改善

### レンタル道具セクション

**現状:** `{item.name} × {item.qty}` のみのテキスト表示

**変更後:** カード形式に変更。各アイテムに泊数・単価・小計を表示。

- 泊数は `checkout_date - checkin_date` で計算
- 小計 = `item.price × item.qty × nights`
- `rental_items` の型: `{ name: string; qty: number; price: number }[]`

表示例：
```
🎒 レンタル道具
┌─────────────────────────────────┐
│ テント用ランタン  × 2個          │
│ ¥500/泊 × 2泊 = ¥2,000         │
└─────────────────────────────────┘
```

### 送迎セクション

**現状:** dl の1行として `3名（新宿駅）` のように表示

**変更後:** `r.transfer_count > 0` の場合のみ、独立したカードとして強調表示

```
🚌 送迎
  新宿駅 ／ 3名
```

---

## 変更③：キャンセル完了後のアクション

### 現状

`CancelModal.tsx` で成功後: `router.refresh()` → `onClose()` で閉じるだけ。  
ゲストはキャンセル済みバッジを見るだけで次のアクションが不明。

### 変更後

`CancelModal.tsx` に `'done'` ステートを追加。  
成功後は `router.refresh()` / `onClose()` を呼ばず、モーダル内に完了画面を表示。

```
✅ キャンセルが完了しました

キャンセル料: 無料 （または ¥X,XXX）

[ホームに戻る]  [新しい予約をする]
```

- 「ホームに戻る」→ `router.push('/')`
- 「新しい予約をする」→ `router.push('/reserve')`
- モーダル外クリックは `'done'` ステート中は無効化（誤操作防止）

---

## 変更ファイル一覧

```
components/reserve/StepPayment.tsx        # ① リダイレクト先2箇所を変更
app/reserve/complete/page.tsx             # ① 削除
app/reserve/lookup/[id]/page.tsx          # ② レンタル道具・送迎カード表示
components/reserve/CancelModal.tsx        # ③ 'done' ステート追加・2ボタン表示
```

---

## データ型

`rental_items` は JSONB 配列として DB に保存されており、各要素は:
```typescript
{ name: string; qty: number; price: number }
```

泊数計算:
```typescript
const nights = Math.max(1, Math.round(
  (new Date(r.checkout_date).getTime() - new Date(r.checkin_date).getTime())
  / (1000 * 60 * 60 * 24)
))
```

---

## テスト方針

- ビルドエラーなし（TypeScript）
- `npm test` 全テスト通過（変更はすべてUIコンポーネントのためユニットテスト対象外）
- ローカルで以下を手動確認:
  - Stripe 未設定で予約完了 → `/reserve/lookup/{id}` に遷移すること
  - レンタル道具あり予約の詳細ページでカード表示になること
  - キャンセル確定後にモーダル内に2ボタンが表示されること
