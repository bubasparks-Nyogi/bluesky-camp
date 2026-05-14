# @blueSky Phase 4 メール送信 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予約作成・キャンセル時に React Email + Resend で確認メール（お客様・オーナー各2通）を自動送信する。

**Architecture:** `emails/` ディレクトリに React Email テンプレート4本を作成し、`lib/email.ts` の2つのヘルパー関数（`sendReservationEmails` / `sendCancellationEmails`）経由で呼び出す。API ルートはメール送信をベストエフォート（`.catch(console.error)`）で呼び出すため、メール失敗が予約・キャンセル処理をブロックしない。

**Tech Stack:** Next.js 14, React Email (`@react-email/components`), Resend, TypeScript

**Phase 4 location:** `C:\Users\biscu\Downloads\bluesky-camp`

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
├── route.ts                  # INSERT 後にメール送信追加（修正）
└── [id]/cancel/route.ts      # UPDATE 後にメール送信追加・SELECT 拡張（修正）
```

---

## Task 1: パッケージインストール + 環境変数追加

**Files:**
- Run: `npm install react-email @react-email/components`
- Modify: `.env.local`

- [ ] **Step 1: パッケージをインストール**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm install react-email @react-email/components
```

Expected: `package.json` の `dependencies` に `react-email` と `@react-email/components` が追加される。

- [ ] **Step 2: .env.local に NEXT_PUBLIC_SITE_URL を追加**

`.env.local` の末尾に追記する:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

（本番デプロイ時は `https://your-domain.com` に変更すること）

- [ ] **Step 3: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | tail -5
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json
git commit -m "feat: react-email / @react-email/components インストール"
```

---

## Task 2: ReservationConfirm（お客様：予約確認メール）

**Files:**
- Create: `emails/ReservationConfirm.tsx`

- [ ] **Step 1: `emails/ReservationConfirm.tsx` を作成**

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
}

export default function ReservationConfirm({
  reservationId, guestName, checkinDate, checkoutDate,
  stayTypes, sauna, pet, ehu, transferCount, transferStation,
  totalAmount, siteUrl,
}: Props) {
  const shortId   = reservationId.slice(0, 8).toUpperCase()
  const detailUrl = `${siteUrl}/reserve/lookup/${reservationId}`
  const typeLabel = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')

  return (
    <Html lang="ja">
      <Preview>【@blueSky】ご予約確認 - {shortId}</Preview>
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
              <Text style={cardRow}><strong>ステータス</strong>確認中</Text>
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
const button:     React.CSSProperties = { backgroundColor: '#d4845a', color: '#ffffff', padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const policyBox:  React.CSSProperties = { backgroundColor: '#f9eed8', borderLeft: '3px solid #d4845a', padding: '12px 16px', marginTop: '24px' }
const policyTitle:React.CSSProperties = { color: '#5a3010', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px' }
const policyText: React.CSSProperties = { color: '#7c4a1e', fontSize: '12px', margin: '2px 0' }
const footer:     React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText: React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
```

- [ ] **Step 2: コミット**

```bash
git add emails/ReservationConfirm.tsx
git commit -m "feat: ReservationConfirm メールテンプレート追加"
```

---

## Task 3: ReservationNotify（オーナー：新規予約通知）

**Files:**
- Create: `emails/ReservationNotify.tsx`

- [ ] **Step 1: `emails/ReservationNotify.tsx` を作成**

```typescript
// emails/ReservationNotify.tsx
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
  guestEmail:      string
  guestPhone:      string
  checkinDate:     string
  checkoutDate:    string
  stayTypes:       string[]
  sauna:           boolean
  pet:             boolean
  ehu:             boolean
  transferCount:   number
  transferStation: string | null
  totalAmount:     number
  adminUrl:        string
}

export default function ReservationNotify({
  reservationId, guestName, guestEmail, guestPhone,
  checkinDate, checkoutDate, stayTypes,
  sauna, pet, ehu, transferCount, transferStation,
  totalAmount, adminUrl,
}: Props) {
  const shortId   = reservationId.slice(0, 8).toUpperCase()
  const typeLabel = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')

  return (
    <Html lang="ja">
      <Preview>【新規予約】{shortId} - {guestName} 様</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>@blueSky 管理</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>新規予約が入りました</Heading>

            <Section style={card}>
              <Text style={sectionLabel}>予約情報</Text>
              <Text style={cardRow}><strong>予約番号</strong>{shortId}</Text>
              <Text style={cardRow}><strong>チェックイン</strong>{checkinDate}</Text>
              <Text style={cardRow}><strong>チェックアウト</strong>{checkoutDate}</Text>
              <Text style={cardRow}><strong>宿泊タイプ</strong>{typeLabel}</Text>
              {sauna         && <Text style={cardRow}><strong>サウナ</strong>利用</Text>}
              {pet           && <Text style={cardRow}><strong>ペット</strong>同伴</Text>}
              {ehu           && <Text style={cardRow}><strong>EHU</strong>使用</Text>}
              {transferCount > 0 && (
                <Text style={cardRow}>
                  <strong>送迎</strong>{transferCount}名（{transferStation}）
                </Text>
              )}
              <Hr style={divider} />
              <Text style={totalRow}><strong>合計金額</strong>¥{totalAmount.toLocaleString()}</Text>
            </Section>

            <Section style={card}>
              <Text style={sectionLabel}>お客様情報</Text>
              <Text style={cardRow}><strong>お名前</strong>{guestName}</Text>
              <Text style={cardRow}><strong>メール</strong>{guestEmail}</Text>
              <Text style={cardRow}><strong>電話</strong>{guestPhone}</Text>
            </Section>

            <Button href={adminUrl} style={button}>
              管理画面で確認する
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>@blueSky 予約管理システム</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ---- styles ---- */
const body:        React.CSSProperties = { backgroundColor: '#fdf8f0', fontFamily: 'sans-serif' }
const container:   React.CSSProperties = { maxWidth: '600px', margin: '0 auto' }
const header:      React.CSSProperties = { backgroundColor: '#3d2010', padding: '24px', textAlign: 'center' }
const logo:        React.CSSProperties = { color: '#fdf8f0', fontSize: '20px', margin: 0 }
const content:     React.CSSProperties = { padding: '32px 24px' }
const h2:          React.CSSProperties = { color: '#5a3010', fontSize: '18px', marginBottom: '16px' }
const card:        React.CSSProperties = { backgroundColor: '#f9eed8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const sectionLabel:React.CSSProperties = { color: '#a05a30', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const cardRow:     React.CSSProperties = { color: '#5a3010', fontSize: '14px', margin: '4px 0' }
const totalRow:    React.CSSProperties = { color: '#5a3010', fontSize: '16px', fontWeight: 'bold', margin: '4px 0' }
const divider:     React.CSSProperties = { borderColor: '#f0c080', margin: '12px 0' }
const button:      React.CSSProperties = { backgroundColor: '#5a3010', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }
const footer:      React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText:  React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
```

- [ ] **Step 2: コミット**

```bash
git add emails/ReservationNotify.tsx
git commit -m "feat: ReservationNotify メールテンプレート追加"
```

---

## Task 4: CancellationConfirm（お客様：キャンセル確認メール）

**Files:**
- Create: `emails/CancellationConfirm.tsx`

- [ ] **Step 1: `emails/CancellationConfirm.tsx` を作成**

```typescript
// emails/CancellationConfirm.tsx
import {
  Html, Body, Container, Heading, Text, Button, Section, Preview,
} from '@react-email/components'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}

interface Props {
  reservationId: string
  guestName:     string
  checkinDate:   string
  checkoutDate:  string
  stayTypes:     string[]
  feeRate:       number    // 0 | 50 | 100
  feeAmount:     number
  feeLabel:      string    // '無料' | '合計金額の50%' | '合計金額の100%'
  siteUrl:       string
}

export default function CancellationConfirm({
  reservationId, guestName, checkinDate, checkoutDate,
  stayTypes, feeRate, feeAmount, feeLabel, siteUrl,
}: Props) {
  const shortId   = reservationId.slice(0, 8).toUpperCase()
  const typeLabel = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')

  return (
    <Html lang="ja">
      <Preview>【@blueSky】キャンセル受付 - {shortId}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>@blueSky</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>{guestName} 様、キャンセルを受け付けました</Heading>

            <Section style={card}>
              <Text style={cardRow}><strong>予約番号</strong>{shortId}</Text>
              <Text style={cardRow}><strong>チェックイン</strong>{checkinDate}</Text>
              <Text style={cardRow}><strong>チェックアウト</strong>{checkoutDate}</Text>
              <Text style={cardRow}><strong>宿泊タイプ</strong>{typeLabel}</Text>
            </Section>

            {/* キャンセル料 */}
            <Section style={feeBox}>
              <Text style={feeTitle}>キャンセル料</Text>
              {feeRate === 0 ? (
                <Text style={feeAmountFree}>無料</Text>
              ) : (
                <>
                  <Text style={feeAmountCharged}>¥{feeAmount.toLocaleString()}</Text>
                  <Text style={feeNote}>（{feeLabel}）</Text>
                </>
              )}
              <Text style={feeDisclaimer}>※ お支払いについては別途ご連絡します</Text>
            </Section>

            <Button href={`${siteUrl}/reserve`} style={button}>
              再予約はこちら
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              このメールはキャンセル確定時に自動送信されています。
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ---- styles ---- */
const body:            React.CSSProperties = { backgroundColor: '#fdf8f0', fontFamily: 'sans-serif' }
const container:       React.CSSProperties = { maxWidth: '600px', margin: '0 auto' }
const header:          React.CSSProperties = { backgroundColor: '#5a3010', padding: '24px', textAlign: 'center' }
const logo:            React.CSSProperties = { color: '#fdf8f0', fontSize: '24px', margin: 0 }
const content:         React.CSSProperties = { padding: '32px 24px' }
const h2:              React.CSSProperties = { color: '#5a3010', fontSize: '18px', marginBottom: '16px' }
const card:            React.CSSProperties = { backgroundColor: '#f9eed8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const cardRow:         React.CSSProperties = { color: '#5a3010', fontSize: '14px', margin: '4px 0' }
const feeBox:          React.CSSProperties = { backgroundColor: '#fff8f0', border: '1px solid #f0c080', borderRadius: '8px', padding: '16px', marginBottom: '24px', textAlign: 'center' }
const feeTitle:        React.CSSProperties = { color: '#7c4a1e', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }
const feeAmountFree:   React.CSSProperties = { color: '#16a34a', fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }
const feeAmountCharged:React.CSSProperties = { color: '#dc2626', fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }
const feeNote:         React.CSSProperties = { color: '#7c4a1e', fontSize: '12px', margin: '2px 0' }
const feeDisclaimer:   React.CSSProperties = { color: '#a05a30', fontSize: '11px', marginTop: '12px' }
const button:          React.CSSProperties = { backgroundColor: '#d4845a', color: '#ffffff', padding: '12px 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }
const footer:          React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText:      React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
```

- [ ] **Step 2: コミット**

```bash
git add emails/CancellationConfirm.tsx
git commit -m "feat: CancellationConfirm メールテンプレート追加"
```

---

## Task 5: CancellationNotify（オーナー：キャンセル通知）

**Files:**
- Create: `emails/CancellationNotify.tsx`

- [ ] **Step 1: `emails/CancellationNotify.tsx` を作成**

```typescript
// emails/CancellationNotify.tsx
import {
  Html, Body, Container, Heading, Text, Button, Hr, Section, Preview,
} from '@react-email/components'

const STAY_LABELS: Record<string, string> = {
  tent: 'テント設営', trailer_a: 'トレーラーA',
  trailer_b: 'トレーラーB', campervan: 'キャンピングカー乗り入れ',
}

interface Props {
  reservationId: string
  guestName:     string
  guestEmail:    string
  guestPhone:    string
  checkinDate:   string
  checkoutDate:  string
  stayTypes:     string[]
  totalAmount:   number
  feeRate:       number
  feeAmount:     number
  feeLabel:      string
  cancelledAt:   string   // ISO 文字列
  adminUrl:      string
}

export default function CancellationNotify({
  reservationId, guestName, guestEmail, guestPhone,
  checkinDate, checkoutDate, stayTypes,
  totalAmount, feeRate, feeAmount, feeLabel,
  cancelledAt, adminUrl,
}: Props) {
  const shortId   = reservationId.slice(0, 8).toUpperCase()
  const typeLabel = stayTypes.map(t => STAY_LABELS[t] ?? t).join('・')
  const cancelledDate = new Date(cancelledAt).toLocaleString('ja-JP')

  return (
    <Html lang="ja">
      <Preview>【キャンセル】{shortId} - {guestName} 様</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logo}>@blueSky 管理</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>キャンセルが発生しました</Heading>

            <Section style={card}>
              <Text style={sectionLabel}>キャンセルされた予約</Text>
              <Text style={cardRow}><strong>予約番号</strong>{shortId}</Text>
              <Text style={cardRow}><strong>チェックイン</strong>{checkinDate}</Text>
              <Text style={cardRow}><strong>チェックアウト</strong>{checkoutDate}</Text>
              <Text style={cardRow}><strong>宿泊タイプ</strong>{typeLabel}</Text>
              <Text style={cardRow}><strong>予約金額</strong>¥{totalAmount.toLocaleString()}</Text>
              <Text style={cardRow}><strong>キャンセル日時</strong>{cancelledDate}</Text>
            </Section>

            <Section style={feeCard}>
              <Text style={sectionLabel}>キャンセル料</Text>
              <Hr style={divider} />
              {feeRate === 0 ? (
                <Text style={feeAmountFree}>無料（0円）</Text>
              ) : (
                <Text style={feeAmountCharged}>¥{feeAmount.toLocaleString()}（{feeLabel}）</Text>
              )}
            </Section>

            <Section style={card}>
              <Text style={sectionLabel}>お客様情報</Text>
              <Text style={cardRow}><strong>お名前</strong>{guestName}</Text>
              <Text style={cardRow}><strong>メール</strong>{guestEmail}</Text>
              <Text style={cardRow}><strong>電話</strong>{guestPhone}</Text>
            </Section>

            <Button href={adminUrl} style={button}>
              管理画面で確認する
            </Button>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>@blueSky 予約管理システム</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

/* ---- styles ---- */
const body:            React.CSSProperties = { backgroundColor: '#fdf8f0', fontFamily: 'sans-serif' }
const container:       React.CSSProperties = { maxWidth: '600px', margin: '0 auto' }
const header:          React.CSSProperties = { backgroundColor: '#3d2010', padding: '24px', textAlign: 'center' }
const logo:            React.CSSProperties = { color: '#fdf8f0', fontSize: '20px', margin: 0 }
const content:         React.CSSProperties = { padding: '32px 24px' }
const h2:              React.CSSProperties = { color: '#5a3010', fontSize: '18px', marginBottom: '16px' }
const card:            React.CSSProperties = { backgroundColor: '#f9eed8', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const feeCard:         React.CSSProperties = { backgroundColor: '#fff0f0', border: '1px solid #fca5a5', borderRadius: '8px', padding: '16px', marginBottom: '16px' }
const sectionLabel:    React.CSSProperties = { color: '#a05a30', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const cardRow:         React.CSSProperties = { color: '#5a3010', fontSize: '14px', margin: '4px 0' }
const divider:         React.CSSProperties = { borderColor: '#fca5a5', margin: '8px 0' }
const feeAmountFree:   React.CSSProperties = { color: '#16a34a', fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }
const feeAmountCharged:React.CSSProperties = { color: '#dc2626', fontSize: '18px', fontWeight: 'bold', margin: '4px 0' }
const button:          React.CSSProperties = { backgroundColor: '#5a3010', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block', marginBottom: '8px' }
const footer:          React.CSSProperties = { backgroundColor: '#3d2010', padding: '16px 24px' }
const footerText:      React.CSSProperties = { color: '#f9eed8', fontSize: '11px', textAlign: 'center', margin: 0 }
```

- [ ] **Step 2: コミット**

```bash
git add emails/CancellationNotify.tsx
git commit -m "feat: CancellationNotify メールテンプレート追加"
```

---

## Task 6: lib/email.ts（送信ヘルパー）

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: `lib/email.ts` を作成**

```typescript
// lib/email.ts
import { Resend } from 'resend'
import { render } from '@react-email/components'
import ReservationConfirm  from '@/emails/ReservationConfirm'
import ReservationNotify   from '@/emails/ReservationNotify'
import CancellationConfirm from '@/emails/CancellationConfirm'
import CancellationNotify  from '@/emails/CancellationNotify'
import type { CancellationFeeResult } from '@/lib/cancellation'

const resend  = new Resend(process.env.RESEND_API_KEY!)
const FROM    = process.env.RESEND_FROM_EMAIL!
const OWNER   = process.env.OWNER_EMAIL!
const SITE    = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
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
 * 失敗しても例外を投げない（呼び出し元でベストエフォート処理すること）。
 */
export async function sendReservationEmails(r: ReservationEmailData): Promise<void> {
  const stayTypes = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId   = r.id.slice(0, 8).toUpperCase()

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
      subject: `【@blueSky】ご予約確認 - ${shortId}`,
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
 * キャンセル後：お客様へのキャンセル確認メール + オーナーへの通知メールを送信する。
 * 失敗しても例外を投げない（呼び出し元でベストエフォート処理すること）。
 */
export async function sendCancellationEmails(
  r: ReservationEmailData,
  fee: CancellationFeeResult,
): Promise<void> {
  const stayTypes     = r.stay_types?.length ? r.stay_types : [r.stay_type]
  const shortId       = r.id.slice(0, 8).toUpperCase()
  const cancelledAt   = new Date().toISOString()

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
npm run build 2>&1 | grep -E "(error TS|Error:|✓ Compiled)" | head -20
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: コミット**

```bash
git add lib/email.ts
git commit -m "feat: lib/email.ts メール送信ヘルパー追加"
```

---

## Task 7: API ルートへの組み込み

**Files:**
- Modify: `app/api/reservations/route.ts`
- Modify: `app/api/reservations/[id]/cancel/route.ts`

- [ ] **Step 1: `app/api/reservations/route.ts` を修正**

`import` ブロックの末尾に追加:

```typescript
import { sendReservationEmails } from '@/lib/email'
```

`return NextResponse.json({ clientSecret, reservationId: reservation.id })` の直前に追加:

```typescript
  // メール送信（ベストエフォート：失敗しても予約は成功扱い）
  sendReservationEmails(reservation).catch(console.error)
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
      status:           'pending',
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
  sendReservationEmails(reservation).catch(console.error)

  return NextResponse.json({ clientSecret, reservationId: reservation.id })
}
```

- [ ] **Step 2: `app/api/reservations/[id]/cancel/route.ts` を修正**

キャンセル API は現在 `guest_phone`, `checkout_date`, `stay_types`, `stay_type` を取得していないため SELECT を拡張し、メール送信を追加する。

修正後のファイル全体:

```typescript
// app/api/reservations/[id]/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calcCancellationFee } from '@/lib/cancellation'
import { sendCancellationEmails } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 })
  }

  // 予約を取得（メール送信に必要なフィールドも含めて取得）
  const { data: reservation, error: fetchErr } = await supabaseAdmin
    .from('reservations')
    .select('id, guest_name, guest_email, guest_phone, status, checkin_date, checkout_date, stay_type, stay_types, sauna, pet, ehu, transfer_count, transfer_station, total_amount')
    .eq('id', params.id)
    .single()

  if (fetchErr || !reservation) {
    return NextResponse.json({ error: '予約が見つかりません' }, { status: 404 })
  }

  // 所有権確認（メールアドレス照合）— セキュリティのため 403 も 404 と同じメッセージ
  if (reservation.guest_email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: '予約が見つかりません' }, { status: 403 })
  }

  // すでにキャンセル済み
  if (reservation.status === 'cancelled') {
    return NextResponse.json({ error: 'すでにキャンセル済みです' }, { status: 409 })
  }

  // キャンセル料計算
  const feeResult = calcCancellationFee(reservation.checkin_date, reservation.total_amount)

  // ステータスを cancelled に更新
  const { error: updateErr } = await supabaseAdmin
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', params.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // メール送信（ベストエフォート：失敗しても処理は成功扱い）
  sendCancellationEmails(reservation, feeResult).catch(console.error)

  return NextResponse.json({
    ok:  true,
    fee: feeResult,
  })
}
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
cd "C:\Users\biscu\Downloads\bluesky-camp"
npm run build 2>&1 | grep -E "(error TS|Error:|✓ Compiled)" | head -20
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: 全テスト実行**

```bash
npm test
```

Expected: 29 tests passed（既存テストが引き続き通過すること）

- [ ] **Step 5: コミット**

```bash
git add app/api/reservations/route.ts "app/api/reservations/[id]/cancel/route.ts"
git commit -m "feat: 予約・キャンセル時のメール送信を組み込み（Phase 4）"
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
