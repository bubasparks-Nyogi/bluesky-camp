# @blueSky Phase 7 予約確認UX改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予約完了後の直接遷移・詳細ページの表示改善・キャンセル完了後のアクション追加の3点でゲスト体験を改善する。

**Architecture:** UIコンポーネント4ファイルの変更のみ。APIやDBの変更なし。`/reserve/complete` ページを削除し、`StepPayment` のリダイレクト先を `/reserve/lookup/{id}` に変更。詳細ページにレンタル道具・送迎カードを追加。`CancelModal` に `done` ステートを追加して完了後の2ボタンを表示。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS（warm パレット）

---

## ファイルマップ

```
components/reserve/
├── StepPayment.tsx               # ① リダイレクト先2箇所を変更（修正）
└── CancelModal.tsx               # ③ done ステート追加（修正）

app/reserve/
├── complete/page.tsx             # ① 削除
└── lookup/[id]/page.tsx          # ② レンタル道具・送迎カード表示（修正）
```

---

## Task 1: StepPayment リダイレクト変更 + complete ページ削除

**Files:**
- Modify: `components/reserve/StepPayment.tsx`
- Delete: `app/reserve/complete/page.tsx`

- [ ] **Step 1: StepPayment.tsx のリダイレクト先を2箇所変更**

`components/reserve/StepPayment.tsx` を以下に差し替える:

```typescript
'use client'
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { ReservationFormData } from '@/types/reservation'
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
interface Props { form: ReservationFormData; onBack: () => void }
export default function StepPayment({ form, onBack }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const paymentConfigured = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.includes('placeholder')

  const initPayment = async () => {
    setLoading(true)
    const res = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { setInitError(data.error); setLoading(false); return }
    // Stripe 未設定時は予約詳細ページへ直接遷移
    if (!data.clientSecret) {
      window.location.href = `/reserve/lookup/${data.reservationId}`
      return
    }
    setClientSecret(data.clientSecret); setReservationId(data.reservationId); setLoading(false)
  }
  if (!clientSecret) return (
    <div>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">決済</h3>
      {initError && <p className="text-red-500 text-sm mb-4">{initError}</p>}
      <p className="text-warm-500 text-sm mb-8">「決済画面へ進む」を押すとStripe決済画面が表示されます。</p>
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button onClick={initPayment} disabled={loading} className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors text-base">{loading ? '準備中...' : paymentConfigured ? '決済画面へ進む' : '予約を確定する'}</button>
      </div>
    </div>
  )
  return <Elements stripe={stripePromise} options={{ clientSecret, locale: 'ja' }}><PaymentForm reservationId={reservationId!} onBack={onBack} /></Elements>
}
function PaymentForm({ reservationId, onBack }: { reservationId: string; onBack: () => void }) {
  const stripe = useStripe(); const elements = useElements()
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!stripe || !elements) return; setLoading(true)
    const { error: err } = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/reserve/lookup/${reservationId}` } })
    if (err) { setError(err.message ?? '決済に失敗しました'); setLoading(false) }
  }
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-serif text-xl text-warm-600 font-bold mb-6">決済情報を入力</h3>
      <PaymentElement className="mb-6" />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-base">← 戻る</button>
        <button type="submit" disabled={loading || !stripe} className="flex-1 bg-warm-300 hover:bg-warm-400 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors text-base">{loading ? '処理中...' : '支払いを確定する'}</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: app/reserve/complete/page.tsx を削除**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
rm "app/reserve/complete/page.tsx"
rmdir "app/reserve/complete" 2>/dev/null || true
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | tail -5
```

Expected: エラーなし（`/reserve/complete` への参照はなくなっているはず）

- [ ] **Step 4: コミット**

```bash
git add components/reserve/StepPayment.tsx
git rm "app/reserve/complete/page.tsx"
git commit -m "feat: 予約完了後を /reserve/complete から /reserve/lookup/{id} へ直接遷移に変更"
```

---

## Task 2: 予約詳細ページに送迎・レンタル道具カードを追加

**Files:**
- Modify: `app/reserve/lookup/[id]/page.tsx`

- [ ] **Step 1: page.tsx を以下に差し替える**

```typescript
// app/reserve/lookup/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { calcCancellationFee } from '@/lib/cancellation'
import CancelModalWrapper from './CancelModalWrapper'

const STAY_LABELS: Record<string, string> = {
  tent:      'テント設営',
  trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB',
  campervan: 'キャンピングカー乗り入れ',
}
const STATUS_LABELS: Record<string, string> = {
  pending:   '確認中',
  confirmed: '確定',
  cancelled: 'キャンセル済み',
}
const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-400',
}

export default async function ReservationLookupDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: r } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!r) notFound()

  const feeResult  = calcCancellationFee(r.checkin_date, r.total_amount)
  const types      = Array.isArray(r.stay_types) && r.stay_types.length
    ? (r.stay_types as string[])
    : [(r.stay_type as string)]
  const canCancel  = r.status !== 'cancelled'

  // 泊数計算（最低1泊）
  const nights = Math.max(1, Math.round(
    (new Date(r.checkout_date).getTime() - new Date(r.checkin_date).getTime())
    / (1000 * 60 * 60 * 24)
  ))

  const rentalItems = Array.isArray(r.rental_items)
    ? (r.rental_items as { name: string; qty: number; price: number }[])
    : []

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-warm-600 text-white py-4 px-6 flex items-center gap-4">
        <Link href="/" className="text-warm-200 hover:text-white text-sm">← ホームに戻る</Link>
        <span className="font-serif text-lg">予約確認</span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-warm-400 mb-1">予約番号</p>
              <p className="font-bold text-warm-700 text-lg tracking-widest">
                {r.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[r.status] ?? r.status}
            </span>
          </div>

          <dl className="space-y-3 text-sm">
            {([
              ['チェックイン',   r.checkin_date],
              ['チェックアウト', r.checkout_date],
              ['宿泊タイプ',     types.map((t: string) => STAY_LABELS[t] ?? t).join('・')],
              ['サウナ',         r.sauna ? '利用' : 'なし'],
              ['ペット',         r.pet   ? '同伴' : 'なし'],
              ['EHU',            r.ehu   ? '使用（使用量料金制）' : 'なし'],
              ['お名前',         r.guest_name],
              ['メール',         r.guest_email],
              ['電話番号',       r.guest_phone],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <dt className="w-28 shrink-0 text-warm-400">{k}</dt>
                <dd className="text-warm-700">{v}</dd>
              </div>
            ))}
          </dl>

          {/* 送迎カード */}
          {r.transfer_count > 0 && (
            <div className="mt-4 pt-4 border-t border-warm-100">
              <p className="text-xs text-warm-400 mb-2">🚌 送迎</p>
              <div className="bg-warm-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-warm-700">{r.transfer_station}</p>
                <p className="text-warm-500 mt-0.5">{r.transfer_count}名</p>
              </div>
            </div>
          )}

          {/* レンタル道具カード */}
          {rentalItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-warm-100">
              <p className="text-xs text-warm-400 mb-2">🎒 レンタル道具</p>
              <div className="space-y-2">
                {rentalItems.map((item, i) => {
                  const subtotal = item.price * item.qty * nights
                  return (
                    <div key={i} className="bg-warm-50 rounded-lg p-3 flex justify-between items-start text-sm">
                      <div>
                        <p className="font-medium text-warm-700">{item.name} × {item.qty}個</p>
                        <p className="text-xs text-warm-400 mt-0.5">
                          ¥{item.price.toLocaleString()}/泊 × {nights}泊
                        </p>
                      </div>
                      <p className="font-bold text-warm-700">¥{subtotal.toLocaleString()}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-warm-100 flex justify-between items-center">
            <span className="text-warm-500 text-sm">合計金額</span>
            <span className="font-bold text-warm-700 text-lg">
              ¥{r.total_amount.toLocaleString()}
            </span>
          </div>
        </div>

        {canCancel && (
          <CancelModalWrapper
            reservationId={r.id}
            guestEmail={r.guest_email}
            checkinDate={r.checkin_date}
            totalAmount={r.total_amount}
            feeResult={feeResult}
          />
        )}

        {r.status === 'cancelled' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center text-sm text-red-600">
            この予約はキャンセル済みです
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | tail -5
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add "app/reserve/lookup/[id]/page.tsx"
git commit -m "feat: 予約詳細ページに送迎・レンタル道具カードを追加（単価・小計表示）"
```

---

## Task 3: CancelModal に完了ステートと2ボタンを追加

**Files:**
- Modify: `components/reserve/CancelModal.tsx`

- [ ] **Step 1: CancelModal.tsx を以下に差し替える**

```typescript
// components/reserve/CancelModal.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CancellationFeeResult } from '@/lib/cancellation'

interface Props {
  reservationId: string
  guestEmail:    string
  checkinDate:   string
  totalAmount:   number
  feeResult:     CancellationFeeResult
  onClose:       () => void
}

export default function CancelModal({
  reservationId, guestEmail, feeResult, onClose
}: Props) {
  const router              = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)

  const handleCancel = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/reservations/${reservationId}/cancel`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: guestEmail }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'エラーが発生しました')
      setLoading(false)
      return
    }
    setDone(true)
  }

  return (
    // done ステート中はモーダル外クリックを無効化
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      onClick={done ? undefined : onClose}
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full"
           onClick={e => e.stopPropagation()}>

        {done ? (
          /* ── 完了ステート ── */
          <>
            <div className="text-center mb-5">
              <p className="text-3xl mb-3">✅</p>
              <h3 className="font-bold text-warm-700 text-lg">キャンセルが完了しました</h3>
            </div>
            <div className="bg-warm-50 rounded-xl p-4 mb-5 text-center">
              <p className="text-sm text-warm-600 font-medium mb-1">キャンセル料</p>
              {feeResult.rate === 0 ? (
                <p className="text-xl font-bold text-green-600">無料</p>
              ) : (
                <>
                  <p className="text-xl font-bold text-red-600">
                    ¥{feeResult.fee.toLocaleString()}
                  </p>
                  <p className="text-xs text-warm-400 mt-1">（{feeResult.label}）</p>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/')}
                className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-sm"
              >
                ホームに戻る
              </button>
              <button
                onClick={() => router.push('/reserve')}
                className="flex-1 bg-warm-300 hover:bg-warm-400 text-white font-bold py-3 rounded-lg text-sm transition-colors"
              >
                新しい予約をする
              </button>
            </div>
          </>
        ) : (
          /* ── 確認ステート ── */
          <>
            <h3 className="font-bold text-warm-700 text-lg mb-4">キャンセルの確認</h3>
            <div className="bg-warm-50 rounded-xl p-4 mb-5">
              <p className="text-sm text-warm-600 font-medium mb-1">キャンセル料</p>
              {feeResult.rate === 0 ? (
                <p className="text-xl font-bold text-green-600">無料</p>
              ) : (
                <>
                  <p className="text-xl font-bold text-red-600">
                    ¥{feeResult.fee.toLocaleString()}
                  </p>
                  <p className="text-xs text-warm-400 mt-1">（{feeResult.label}）</p>
                </>
              )}
              <p className="text-xs text-warm-400 mt-3">
                ※ お支払いについては別途ご連絡します
              </p>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 border border-warm-200 text-warm-500 font-bold py-3 rounded-lg text-sm"
              >
                戻る
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 bg-red-400 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-3 rounded-lg text-sm transition-colors"
              >
                {loading ? 'キャンセル中...' : 'キャンセルを確定する'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | tail -5
```

Expected: エラーなし

- [ ] **Step 3: 全テスト実行**

```bash
npm test
```

Expected: 31 passed（変更はUIのみのため既存テストへの影響なし）

- [ ] **Step 4: コミット + push**

```bash
git add components/reserve/CancelModal.tsx
git commit -m "feat: キャンセル完了後に「ホームに戻る」「新しい予約をする」ボタンを表示"
git push origin main
```

---

## 手動確認チェックリスト

```bash
npm run dev
```

- [ ] Stripe 未設定で予約完了 → `/reserve/lookup/{id}` に直接遷移すること
- [ ] 送迎あり予約の詳細ページで🚌カードが表示されること
- [ ] レンタル道具あり予約の詳細ページで🎒カードに単価・小計が表示されること
- [ ] キャンセルモーダルで「キャンセルを確定する」後に✅完了画面が表示されること
- [ ] 完了画面の「ホームに戻る」で `/` に遷移すること
- [ ] 完了画面の「新しい予約をする」で `/reserve` に遷移すること
