# @blueSky Phase 5 Stripe Webhook 自動確定 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stripe Webhook 受信で予約を自動確定させ、Stripe 未設定時は作成直後に即時確定する。

**Architecture:** `app/api/reservations/route.ts` で `stripeEnabled` フラグに応じて `status` を分岐。`app/api/webhook/stripe/route.ts` は `payment_intent.succeeded` 受信時に `confirmed` へ更新し Phase 4 の React Email テンプレートで確定メールを送信。重複メールを解消するため `lib/notifications.ts` から旧プレーン HTML メール関数を削除し、LINE ユーティリティのみ残す。

**Tech Stack:** Next.js 14, Supabase, Stripe Webhooks, React Email, TypeScript, Vitest

**Phase 5 location:** `C:\Users\biscu\Downloads\bluesky-camp`

---

## ファイルマップ

```
lib/
├── notifications.ts        # sendReservationNotifications 削除・lineReply のみ残す（修正）
├── notifications.test.ts   # lineReply のテストに更新（修正）
└── email.ts                # status 引数追加 + sendReservationConfirmedEmail 追加（修正）

emails/
└── ReservationConfirm.tsx  # status プロップを動的化（修正）

app/api/
├── reservations/route.ts               # status 分岐追加（修正）
└── webhook/stripe/route.ts             # sendReservationConfirmedEmail 呼び出しに更新（修正）
```

---

## Task 1: lib/notifications.ts 整理 + テスト更新

**Files:**
- Modify: `lib/notifications.ts`
- Modify: `lib/notifications.test.ts`

- [ ] **Step 1: テストを先に更新（RED）**

`lib/notifications.test.ts` を以下に差し替える:

```typescript
// lib/notifications.test.ts
import { describe, it, expect, vi } from 'vitest'
import { lineReply } from './notifications'

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
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm test -- lib/notifications.test.ts
```

Expected: FAIL（`lineReply` が export されていない）

- [ ] **Step 3: lib/notifications.ts を書き換え**

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
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npm test -- lib/notifications.test.ts
```

Expected: PASS（1 test）

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
git add lib/notifications.ts lib/notifications.test.ts
git commit -m "refactor: notifications.ts から旧メール削除・lineReply ユーティリティのみ残す"
```

---

## Task 2: emails/ReservationConfirm.tsx に status プロップを追加

**Files:**
- Modify: `emails/ReservationConfirm.tsx`

- [ ] **Step 1: `emails/ReservationConfirm.tsx` を更新**

`Props` インターフェースに `status` を追加し、ステータス表示を動的化する。  
以下が修正後の完全なファイル:

```typescript
// emails/ReservationConfirm.tsx
import {
  Html, Body, Container, Heading, Text, Button, Hr, Section, Preview,
} from '@react-email/components'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}

interface Props {
  reservationId:   string
  guestName:       string
  checkinDate:     string
  checkoutDate:    string
  stayTypes:       string[]
  sauna:           boolean
  pet:             boolean
  ehu:             boolean
  transferCount:   number
  transferStation: string | null
  totalAmount:     number
  siteUrl:         string
  status:          'pending' | 'confirmed'   // ← 追加
}

export default function ReservationConfirm({
  reservationId, guestName, checkinDate, checkoutDate,
  stayTypes, sauna, pet, ehu, transferCount, transferStation,
  totalAmount, siteUrl, status,
}: Props) {
  const shortId    = reservationId.slice(0, 8).toUpperCase()
  const detailUrl  = `${siteUrl}/reserve/lookup/${reservationId}`
  const typeLabel  = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')
  const statusLabel = status === 'confirmed' ? '確定' : '確認中（決済待ち）'
  const statusColor = status === 'confirmed' ? '#16a34a' : '#d97706'

  return (
    <Html lang="ja">
      <Preview>【@blueSky】ご予約{status === 'confirmed' ? '確認' : '受付'} - {shortId}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* ヘッダー */}
          <Section style={header}>
            <Heading style={logo}>@blueSky</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>{guestName} 様、ご予約ありがとうございます</Heading>
            <Text style={text}>ご予約内容をご確認ください。</Text>

            {/* 予約詳細 */}
            <Section style={card}>
              <Text style={cardRow}><strong>予約番号</strong>{shortId}</Text>
              <Text style={{ ...cardRow, color: statusColor }}>
                <strong style={{ color: '#5a3010' }}>ステータス</strong>{statusLabel}
              </Text>
              {status === 'pending' && (
                <Text style={pendingNote}>※ 決済完了後に確定メールをお送りします</Text>
              )}
              <Hr style={divider} />
              <Text style={cardRow}><strong>チェックイン</strong>{checkinDate}</Text>
              <Text style={cardRow}><strong>チェックアウト</strong>{checkoutDate}</Text>
              <Text style={cardRow}><strong>宿泊タイプ</strong>{typeLabel}</Text>
              {sauna    && <Text style={cardRow}><strong>サウナ</strong>利用</Text>}
              {pet      && <Text style={cardRow}><strong>ペット</strong>同伴</Text>}
              {ehu      && <Text style={cardRow}><strong>EHU</strong>使用（使用量料金制）</Text>}
              {transferCount > 0 && (
                <Text style={cardRow}>
                  <strong>送迎</strong>{transferCount}名（{transferStation}）
                </Text>
              )}
              <Hr style={divider} />
              <Text style={totalRow}>
                <strong>合計金額</strong>¥{totalAmount.toLocaleString()}
              </Text>
            </Section>

            <Button href={detailUrl} style={button}>
              予約を確認する・キャンセルはこちら
            </Button>

            {/* キャンセルポリシー */}
            <Section style={policyBox}>
              <Text style={policyTitle}>キャンセルポリシー</Text>
              <Text style={policyText}>7日前まで：無料</Text>
              <Text style={policyText}>3〜6日前：合計金額の50%</Text>
              <Text style={policyText}>前日・当日：合計金額の100%</Text>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              このメールはご予約完了時に自動送信されています。<br />
              ご不明な点は予約番号をご記載の上お問い合わせください。
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ---- styles ---- */
const body:       React.CSSProperties = { backgroundColor: '#fdf8f0', fontFamily: 'sans-serif' }
const container:  React.CSSProperties = { maxWidth: '600px', margin: '0 auto' }
const header:     React.CSSProperties = { backgroundColor: '#5a3010', padding: '24px', textAlign: 'center' }
const logo:       React.CSSProperties = { color: '#fdf8f0', fontSize: '24px', margin: 0 }
const content:    React.CSSProperties = { padding: '32px 24px' }
const h2:         React.CSSProperties = { color: '#5a3010', fontSize: '18px', marginBottom: '8px' }
const text:       React.CSSProperties = { color: '#7c4a1e', fontSize: '14px', marginBottom: '24px' }
const card:       React.CSSProperties = { backgroundColor: '#f9eed8', borderRadius: '8px', padding: '16px', marginBottom: '24px' }
const cardRow:    React.CSSProperties = { color: '#5a3010', fontSize: '14px', margin: '4px 0', display: 'flex', gap: '16px' }
const totalRow:   React.CSSProperties = { color: '#5a3010', fontSize: '16px', fontWeight: 'bold', margin: '4px 0' }
const divider:    React.CSSProperties = { borderColor: '#f0c080', margin: '12px 0' }
const pendingNote:React.CSSProperties = { color: '#d97706', fontSize: '11px', margin: '2px 0 8px' }
const button:     React.CSSProperties = { backgroundColor: '#d4845a', color: '#ffffff', padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const policyBox:  React.CSSProperties = { backgroundColor: '#f9eed8', borderLeft: '3px solid #d4845a', padding: '12px 16px', marginTop: '24px' }
const policyTitle:React.CSSProperties = { color: '#5a3010', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }
const policyText: React.CSSProperties = { color: '#7c4a1e', fontSize: '12px', margin: '2px 0' }
const footer:     React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText: React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | grep -E "(error TS|Error:|✓ Compiled)" | head -10
```

Expected: TypeScript エラー（`lib/email.ts` が `status` を渡していないため）→ Task 3 で解消

- [ ] **Step 3: コミット**

```bash
git add emails/ReservationConfirm.tsx
git commit -m "feat: ReservationConfirm に status プロップ追加（確認中/確定の動的表示）"
```

---

## Task 3: lib/email.ts に status 対応 + sendReservationConfirmedEmail 追加

**Files:**
- Modify: `lib/email.ts`

- [ ] **Step 1: `lib/email.ts` を更新**

以下が修正後の完全なファイル:

```typescript
// lib/email.ts
import { Resend } from 'resend'
import { render } from '@react-email/components'
import ReservationConfirm  from '@/emails/ReservationConfirm'
import ReservationNotify   from '@/emails/ReservationNotify'
import CancellationConfirm from '@/emails/CancellationConfirm'
import CancellationNotify  from '@/emails/CancellationNotify'
import type { CancellationFeeResult } from '@/lib/cancellation'

const resend    = new Resend(process.env.RESEND_API_KEY!)
const FROM      = process.env.RESEND_FROM_EMAIL!
const OWNER     = process.env.OWNER_EMAIL!
const SITE      = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const ADMIN_URL = `${SITE}/admin/reservations`

interface ReservationEmailData {
  id:               string
  guest_name:       string
  guest_email:      string
  guest_phone:      string
  checkin_date:     string
  checkout_date:    string
  stay_types:       string[]
  stay_type:        string
  sauna:            boolean
  pet:              boolean
  ehu:              boolean
  transfer_count:   number
  transfer_station: string | null
  total_amount:     number
}

/**
 * 予約作成後：お客様への確認メール + オーナーへの通知メールを送信する。
 * @param r      予約データ
 * @param status 'pending'（確認中）または 'confirmed'（確定）。デフォルト 'pending'
 */
export async function sendReservationEmails(
  r: ReservationEmailData,
  status: 'pending' | 'confirmed' = 'pending',
): Promise<void> {
  const stayTypes = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId   = r.id.slice(0, 8).toUpperCase()
  const subject   = status === 'confirmed'
    ? `【@blueSky】ご予約確認 - ${shortId}`
    : `【@blueSky】ご予約受付 - ${shortId}`

  const [guestHtml, ownerHtml] = await Promise.all([
    render(ReservationConfirm({
      reservationId:   r.id,
      guestName:       r.guest_name,
      checkinDate:     r.checkin_date,
      checkoutDate:    r.checkout_date,
      stayTypes,
      sauna:           r.sauna,
      pet:             r.pet,
      ehu:             r.ehu,
      transferCount:   r.transfer_count,
      transferStation: r.transfer_station,
      totalAmount:     r.total_amount,
      siteUrl:         SITE,
      status,
    })),
    render(ReservationNotify({
      reservationId:   r.id,
      guestName:       r.guest_name,
      guestEmail:      r.guest_email,
      guestPhone:      r.guest_phone,
      checkinDate:     r.checkin_date,
      checkoutDate:    r.checkout_date,
      stayTypes,
      sauna:           r.sauna,
      pet:             r.pet,
      ehu:             r.ehu,
      transferCount:   r.transfer_count,
      transferStation: r.transfer_station,
      totalAmount:     r.total_amount,
      adminUrl:        ADMIN_URL,
    })),
  ])

  await Promise.all([
    resend.emails.send({
      from:    FROM,
      to:      r.guest_email,
      subject,
      html:    guestHtml,
    }),
    resend.emails.send({
      from:    FROM,
      to:      OWNER,
      subject: `【新規予約】${shortId} - ${r.guest_name} 様`,
      html:    ownerHtml,
    }),
  ])
}

/**
 * Stripe 決済完了後（Webhook）：お客様への「ご予約確定」メールを 1 通送信する。
 * オーナーへの再通知は不要（予約作成時に送信済み）。
 */
export async function sendReservationConfirmedEmail(
  r: ReservationEmailData,
): Promise<void> {
  const stayTypes = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId   = r.id.slice(0, 8).toUpperCase()

  const guestHtml = await render(ReservationConfirm({
    reservationId:   r.id,
    guestName:       r.guest_name,
    checkinDate:     r.checkin_date,
    checkoutDate:    r.checkout_date,
    stayTypes,
    sauna:           r.sauna,
    pet:             r.pet,
    ehu:             r.ehu,
    transferCount:   r.transfer_count,
    transferStation: r.transfer_station,
    totalAmount:     r.total_amount,
    siteUrl:         SITE,
    status:          'confirmed',
  }))

  await resend.emails.send({
    from:    FROM,
    to:      r.guest_email,
    subject: `【@blueSky】ご予約確定 - ${shortId}`,
    html:    guestHtml,
  })
}

/**
 * キャンセル後：お客様へのキャンセル確認メール + オーナーへの通知メールを送信する。
 */
export async function sendCancellationEmails(
  r: ReservationEmailData,
  fee: CancellationFeeResult,
): Promise<void> {
  const stayTypes   = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId     = r.id.slice(0, 8).toUpperCase()
  const cancelledAt = new Date().toISOString()

  const [guestHtml, ownerHtml] = await Promise.all([
    render(CancellationConfirm({
      reservationId: r.id,
      guestName:     r.guest_name,
      checkinDate:   r.checkin_date,
      checkoutDate:  r.checkout_date,
      stayTypes,
      feeRate:       fee.rate,
      feeAmount:     fee.fee,
      feeLabel:      fee.label,
      siteUrl:       SITE,
    })),
    render(CancellationNotify({
      reservationId: r.id,
      guestName:     r.guest_name,
      guestEmail:    r.guest_email,
      guestPhone:    r.guest_phone,
      checkinDate:   r.checkin_date,
      checkoutDate:  r.checkout_date,
      stayTypes,
      totalAmount:   r.total_amount,
      feeRate:       fee.rate,
      feeAmount:     fee.fee,
      feeLabel:      fee.label,
      cancelledAt,
      adminUrl:      ADMIN_URL,
    })),
  ])

  await Promise.all([
    resend.emails.send({
      from:    FROM,
      to:      r.guest_email,
      subject: `【@blueSky】キャンセル受付 - ${shortId}`,
      html:    guestHtml,
    }),
    resend.emails.send({
      from:    FROM,
      to:      OWNER,
      subject: `【キャンセル】${shortId} - ${r.guest_name} 様`,
      html:    ownerHtml,
    }),
  ])
}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | grep -E "(error TS|Error:|✓ Compiled)" | head -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: 全テスト実行**

```bash
npm test
```

Expected: 29 passed

- [ ] **Step 4: コミット**

```bash
git add lib/email.ts
git commit -m "feat: sendReservationEmails に status 対応 + sendReservationConfirmedEmail 追加"
```

---

## Task 4: app/api/reservations/route.ts の status 分岐

**Files:**
- Modify: `app/api/reservations/route.ts`

- [ ] **Step 1: status フィールドと sendReservationEmails 呼び出しを更新**

`INSERT` ブロックの `status` を以下に変更:

```typescript
status: stripeEnabled ? 'pending' : 'confirmed',
```

`sendReservationEmails` 呼び出しに `status` を渡すよう変更:

```typescript
// 変更前
sendReservationEmails(reservation).catch(console.error)

// 変更後
sendReservationEmails(
  reservation,
  stripeEnabled ? 'pending' : 'confirmed',
).catch(console.error)
```

修正後のファイル全体:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPaymentIntent } from '@/lib/payment'
import { calcTotal } from '@/lib/pricing'
import { sendReservationEmails } from '@/lib/email'
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
      status:           stripeEnabled ? 'pending' : 'confirmed',   // ← 変更
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

  return NextResponse.json({ clientSecret, reservationId: reservation.id })
}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | grep -E "(error TS|Error:|✓ Compiled)" | head -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: コミット**

```bash
git add app/api/reservations/route.ts
git commit -m "feat: Stripe 未設定時に予約を即時 confirmed に変更"
```

---

## Task 5: app/api/webhook/stripe/route.ts 更新

**Files:**
- Modify: `app/api/webhook/stripe/route.ts`

- [ ] **Step 1: webhook route を更新**

`sendReservationNotifications`（旧）を `sendReservationConfirmedEmail`（Phase 5）に置き換え、
SELECT フィールドをメール送信に必要な全カラムに拡張する。

修正後の完全なファイル:

```typescript
// app/api/webhook/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/payment'
import { supabaseAdmin } from '@/lib/supabase'
import { sendReservationConfirmedEmail } from '@/lib/email'

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
    }
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | grep -E "(error TS|Error:|✓ Compiled)" | head -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: 全テスト実行**

```bash
npm test
```

Expected: 29 passed（全既存テストが引き続き通過）

- [ ] **Step 4: コミット + push**

```bash
git add "app/api/webhook/stripe/route.ts"
git commit -m "feat: Webhook で sendReservationConfirmedEmail を呼び出し・旧 notifications 呼び出しを削除"
git push origin main
```

---

## 全体確認

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm test
# 期待: 29 tests passed

npm run build 2>&1 | tail -5
# 期待: エラーなし
```

### ローカル動作確認チェックリスト

- [ ] Stripe なし: `/reserve` で予約完了 → 管理画面で status が `confirmed`
- [ ] Stripe あり（Stripe CLI）: `stripe listen --forward-to localhost:3000/api/webhook/stripe` → 決済完了 → status が `confirmed`
- [ ] お客様予約確認ページ (`/reserve/lookup/[UUID]`) で「確定」が緑表示
