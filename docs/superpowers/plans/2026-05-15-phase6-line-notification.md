# @blueSky Phase 6 LINE オーナー通知 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予約確定時（Stripe Webhook 経由 / Stripe 未設定の即時確定の両方）にオーナーの LINE へ通知を送る。

**Architecture:** `lib/notifications.ts` に `sendOwnerLineNotification` を追加し、`app/api/webhook/stripe/route.ts` と `app/api/reservations/route.ts` の確定パスからベストエフォートで呼び出す。`OWNER_LINE_USER_ID` が未設定なら静かにスキップし、Stripe 有無に関わらず動作する。

**Tech Stack:** Next.js 14, TypeScript, LINE Messaging API（Push）, Vitest

---

## ファイルマップ

```
lib/
├── notifications.ts        # sendOwnerLineNotification を追加（修正）
└── notifications.test.ts   # 新関数のテスト追加（修正）

app/api/
├── webhook/stripe/route.ts # sendOwnerLineNotification 呼び出し追加（修正）
└── reservations/route.ts   # Stripe 無効時に sendOwnerLineNotification 呼び出し追加（修正）
```

---

## Task 1: sendOwnerLineNotification を追加 + テスト

**Files:**
- Modify: `lib/notifications.ts`
- Modify: `lib/notifications.test.ts`

- [ ] **Step 1: テストを先に追記（RED）**

`lib/notifications.test.ts` を以下に差し替える:

```typescript
// lib/notifications.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lineReply, sendOwnerLineNotification } from './notifications'

global.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch

describe('lineReply', () => {
  it('LINE Push API を呼び出す', async () => {
    await expect(
      lineReply('user-123', 'テストメッセージ')
    ).resolves.not.toThrow()
    expect(fetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('sendOwnerLineNotification', () => {
  const reservation = {
    guest_name:   '山田 太郎',
    checkin_date: '2026-07-01',
    stay_type:    'trailer_a',
    total_amount: 25000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.OWNER_LINE_USER_ID
  })

  it('OWNER_LINE_USER_ID が設定されている場合 lineReply を呼び出す', async () => {
    process.env.OWNER_LINE_USER_ID = 'owner-line-id'
    await sendOwnerLineNotification(reservation)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('OWNER_LINE_USER_ID が未設定の場合 lineReply を呼び出さない', async () => {
    await sendOwnerLineNotification(reservation)
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm test -- lib/notifications.test.ts
```

Expected: FAIL（`sendOwnerLineNotification` が export されていない）

- [ ] **Step 3: lib/notifications.ts に sendOwnerLineNotification を追加**

`lib/notifications.ts` を以下に差し替える:

```typescript
// lib/notifications.ts
// LINE Push API ユーティリティ（将来の LINE 通知フェーズで使用）

/**
 * LINE Push API でメッセージを送信する。
 * @param userId  LINE ユーザーID または グループID
 * @param text    送信テキスト
 */
export async function lineReply(userId: string, text: string): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to:       userId,
      messages: [{ type: 'text', text }],
    }),
  })
}

/**
 * 予約確定時にオーナーへ LINE 通知を送信する。
 * OWNER_LINE_USER_ID が未設定の場合は静かにスキップする。
 */
export async function sendOwnerLineNotification(r: {
  guest_name:   string
  checkin_date: string
  stay_type:    string
  total_amount: number
}): Promise<void> {
  const userId = process.env.OWNER_LINE_USER_ID
  if (!userId) return

  const text = `【予約確定】${r.guest_name} 様\n📅 ${r.checkin_date}\n🏕 ${r.stay_type}\n💴 ¥${r.total_amount.toLocaleString()}`
  await lineReply(userId, text)
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- lib/notifications.test.ts
```

Expected: PASS（3 tests）

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
git add lib/notifications.ts lib/notifications.test.ts
git commit -m "feat: sendOwnerLineNotification を追加・予約確定時にオーナーへ LINE 通知"
```

---

## Task 2: Webhook ルートと reservations ルートに呼び出しを追加

**Files:**
- Modify: `app/api/webhook/stripe/route.ts`
- Modify: `app/api/reservations/route.ts`

- [ ] **Step 1: app/api/webhook/stripe/route.ts を更新**

`sendReservationConfirmedEmail` の import に `sendOwnerLineNotification` を追加し、呼び出しを追記する。  
修正後の完全なファイル:

```typescript
// app/api/webhook/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/payment'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReservationConfirmedEmail } from '@/lib/email'
import { sendOwnerLineNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const sig     = req.headers.get('stripe-signature') ?? ''

  let event
  try {
    event = constructWebhookEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string }

    // status を confirmed に更新し、メール送信に必要な全フィールドを取得
    const { data: reservation } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'confirmed' })
      .eq('stripe_payment_id', pi.id)
      .select('id, guest_name, guest_email, guest_phone, checkin_date, checkout_date, stay_type, stay_types, sauna, pet, ehu, transfer_count, transfer_station, total_amount')
      .single()

    if (reservation) {
      // 確定メール送信（ベストエフォート）
      sendReservationConfirmedEmail(reservation).catch(console.error)
      // オーナーへ LINE 通知（ベストエフォート）
      sendOwnerLineNotification(reservation).catch(console.error)
    }
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 2: app/api/reservations/route.ts を更新**

import に `sendOwnerLineNotification` を追加し、`stripeEnabled` が `false` の場合のみ呼び出す。  
修正後の完全なファイル:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPaymentIntent } from '@/lib/payment'
import { calcTotal } from '@/lib/pricing'
import { sendReservationEmails } from '@/lib/email'
import { sendOwnerLineNotification } from '@/lib/notifications'
import type { ReservationFormData } from '@/types/reservation'

// STRIPE_SECRET_KEY が placeholder を含む場合は決済をスキップする
const stripeEnabled = !(process.env.STRIPE_SECRET_KEY ?? '').includes('placeholder')

export async function POST(req: NextRequest) {
  const form: ReservationFormData = await req.json()

  const { data: existing } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('checkin_date', form.checkinDate)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'その日程はすでに予約済みです' }, { status: 409 })
  }

  const { data: pricingRows } = await supabaseAdmin
    .from('pricing')
    .select('*')
    .eq('active', true)

  const pricing = (pricingRows ?? []).map((p: {
    item_key: string; label: string; amount: number; active: boolean
  }) => ({
    itemKey: p.item_key,
    label:   p.label,
    amount:  p.amount,
    active:  p.active,
  }))

  const totalAmount = calcTotal(form, pricing)

  let clientSecret:    string | null = null
  let paymentIntentId: string | null = null

  if (stripeEnabled) {
    const result = await createPaymentIntent({
      amount:      totalAmount,
      currency:    'jpy',
      description: `@blueSky 予約 ${form.checkinDate}`,
      metadata:    {
        guestName:   form.guestName,
        guestEmail:  form.guestEmail,
        checkinDate: form.checkinDate,
      },
    })
    clientSecret    = result.clientSecret
    paymentIntentId = result.paymentIntentId
  }

  const { data: reservation, error } = await supabaseAdmin
    .from('reservations')
    .insert({
      checkin_date:     form.checkinDate,
      checkout_date:    form.checkoutDate,
      status:           stripeEnabled ? 'pending' : 'confirmed',
      stay_type:        form.stayTypes?.[0] ?? 'tent',
      stay_types:       form.stayTypes ?? [],
      ehu:              form.ehu,
      sauna:            form.sauna,
      pet:              form.pet,
      transfer_count:   form.transferCount,
      transfer_station: form.transferStation || null,
      rental_items:     form.rentalItems,
      guest_name:       form.guestName,
      guest_email:      form.guestEmail,
      guest_phone:      form.guestPhone,
      total_amount:       totalAmount,
      stripe_payment_id:  paymentIntentId,
      agreed_to_terms_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // メール送信（ベストエフォート：失敗しても予約は成功扱い）
  sendReservationEmails(
    reservation,
    stripeEnabled ? 'pending' : 'confirmed',
  ).catch(console.error)

  // Stripe 未設定（即時確定）の場合のみ LINE 通知（ベストエフォート）
  if (!stripeEnabled) {
    sendOwnerLineNotification(reservation).catch(console.error)
  }

  return NextResponse.json({ clientSecret, reservationId: reservation.id })
}
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | tail -5
```

Expected: エラーなし

- [ ] **Step 4: 全テスト実行**

```bash
npm test
```

Expected: 31 passed（既存 29 + 新規 2）

- [ ] **Step 5: コミット + push**

```bash
git add app/api/webhook/stripe/route.ts app/api/reservations/route.ts
git commit -m "feat: 確定時に sendOwnerLineNotification を呼び出し（Webhook・即時確定の両パス）"
git push origin main
```
