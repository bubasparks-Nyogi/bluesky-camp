# メール送信を Gmail SMTP に切替 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予約・キャンセル等の通知メールを Resend から無料 Gmail SMTP（nodemailer）に切り替え、確実に届くようにする。

**Architecture:** 送信トランスポートを `lib/mailer.ts`（nodemailer + Gmail SMTP）に集約し、`lib/email.ts` の Resend 呼び出しを差し替える。React Email テンプレート（HTML 生成）は流用。

**Tech Stack:** Next.js 14, nodemailer, @react-email/components, TypeScript。

**参照スペック:** `docs/superpowers/specs/2026-05-20-email-gmail-smtp-design.md`

---

## 前提知識（実装者向け）
- `lib/email.ts` は現在 `resend` SDK でメール送信。`render()`（`@react-email/components`）で生成した HTML を `resend.emails.send({ from, to, subject, html })` で送る。
- 公開関数: `sendReservationEmails(r, status)`, `sendReservationConfirmedEmail(r)`, `sendCancellationEmails(r, fee)`。これらのシグネチャと呼び出し元は変更しない。
- 既存定数（`lib/email.ts` 冒頭）: `FROM = process.env.RESEND_FROM_EMAIL!`, `OWNER = process.env.OWNER_EMAIL!`, `SITE`, `ADMIN_URL`。
- best-effort 思想: メール送信失敗は予約処理を止めない（呼び出し元が `.catch` 済み）。
- シェル: Bash（Git Bash）。パス `C:/Users/biscu/Downloads/bluesky-camp`。

---

### Task 1: nodemailer 導入 + `lib/mailer.ts`

**Files:**
- Modify: `package.json`（install）
- Create: `lib/mailer.ts`

- [ ] **Step 1: nodemailer を追加**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm install nodemailer 2>&1 | tail -3 && npm install -D @types/nodemailer 2>&1 | tail -3
```

- [ ] **Step 2: `lib/mailer.ts` を作成**

```typescript
// lib/mailer.ts
import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD
const SENDER_NAME = '@blueSky'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (!GMAIL_USER || !GMAIL_PASS) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    })
  }
  return transporter
}

/**
 * メールを送信する。GMAIL_USER / GMAIL_APP_PASSWORD 未設定なら
 * 送信せず警告ログのみ（best-effort: 呼び出し元の処理は止めない）。
 */
export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const tx = getTransporter()
  if (!tx || !GMAIL_USER) {
    console.warn('[mailer] GMAIL_USER / GMAIL_APP_PASSWORD 未設定のため送信をスキップしました:', opts.subject)
    return
  }
  await tx.sendMail({
    from: `"${SENDER_NAME}" <${GMAIL_USER}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
}
```

- [ ] **Step 3: 型チェック**

Run: `cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15`
Expected: 新規エラーなし

- [ ] **Step 4: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add package.json package-lock.json lib/mailer.ts && git commit -m "feat(email): add nodemailer Gmail SMTP mailer"
```

---

### Task 2: `lib/email.ts` を Gmail 送信に差し替え

**Files:**
- Modify: `lib/email.ts`

現在の `lib/email.ts` を読み、以下の差し替えを行う。**3つの公開関数のシグネチャ・テンプレート呼び出し・宛先/件名ロジックは維持**し、`resend.emails.send(...)` を `sendMail(...)` に置換する。

- [ ] **Step 1: import と定数を差し替え**

冒頭の以下を:
```typescript
import { Resend } from 'resend'
import { render } from '@react-email/components'
// ... 他テンプレート import
const resend    = new Resend(process.env.RESEND_API_KEY!)
const FROM      = process.env.RESEND_FROM_EMAIL!
const OWNER     = process.env.OWNER_EMAIL!
const SITE      = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const ADMIN_URL = `${SITE}/admin/reservations`
```
次のように変更（`Resend` と `FROM` を削除、`sendMail` を import）:
```typescript
import { render } from '@react-email/components'
import { sendMail } from '@/lib/mailer'
// ... 他テンプレート import はそのまま
const OWNER     = process.env.OWNER_EMAIL!
const SITE      = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const ADMIN_URL = `${SITE}/admin/reservations`
```

- [ ] **Step 2: `sendReservationEmails` 内の送信を置換**

`await Promise.all([ resend.emails.send({from:FROM,to:r.guest_email,subject,html:guestHtml}), resend.emails.send({from:FROM,to:OWNER,subject:`【新規予約】...`,html:ownerHtml}) ])`
の `resend.emails.send({ from: FROM, to, subject, html })` を、それぞれ `sendMail({ to, subject, html })` に置換（`from` 引数を削除）。例:
```typescript
  await Promise.all([
    sendMail({ to: r.guest_email, subject, html: guestHtml }),
    sendMail({ to: OWNER, subject: `【新規予約】${shortId} - ${r.guest_name} 様`, html: ownerHtml }),
  ])
```

- [ ] **Step 3: `sendReservationConfirmedEmail` 内の送信を置換**

`resend.emails.send({ from: FROM, to: r.guest_email, subject: `【@blueSky】ご予約確定 - ${shortId}`, html: guestHtml })`
を:
```typescript
  await sendMail({ to: r.guest_email, subject: `【@blueSky】ご予約確定 - ${shortId}`, html: guestHtml })
```

- [ ] **Step 4: `sendCancellationEmails` 内の送信を置換**

`await Promise.all([...resend.emails.send(...)...])` の2件を:
```typescript
  await Promise.all([
    sendMail({ to: r.guest_email, subject: `【@blueSky】キャンセル受付 - ${shortId}`, html: guestHtml }),
    sendMail({ to: OWNER, subject: `【キャンセル】${shortId} - ${r.guest_name} 様`, html: ownerHtml }),
  ])
```
（件名・HTML 変数名は既存の実装に合わせること。`render(...)` 呼び出しと変数 `guestHtml`/`ownerHtml` はそのまま使う。）

- [ ] **Step 5: Resend 残骸が無いか確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && grep -rn "resend\|RESEND_FROM_EMAIL\|Resend" lib/email.ts
```
Expected: 出力なし（lib/email.ts から Resend 参照が消えている）

- [ ] **Step 6: 型チェック + 全テスト**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v reservation.test | head -15
cd "C:/Users/biscu/Downloads/bluesky-camp" && npx vitest run 2>&1 | tail -5
```
Expected: 新規型エラーなし・全テスト pass（126）

- [ ] **Step 7: ビルド確認**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && npm run build 2>&1 | tail -15
```
Expected: ビルド成功

- [ ] **Step 8: コミット**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git add lib/email.ts && git commit -m "feat(email): send via Gmail SMTP mailer instead of Resend"
```

---

### Task 3: 環境変数設定 + デプロイ

**Files:** なし（設定 + デプロイ）

- [ ] **Step 1: Vercel 環境変数（ユーザー操作）**

ユーザーに以下を Vercel（Production）で設定してもらう:
- `GMAIL_USER` = 送信元 Gmail アドレス（ログインで使ったものと同じでよい）
- `GMAIL_APP_PASSWORD` = Gmail アプリパスワード（16桁）
- `OWNER_EMAIL` = オーナー通知の宛先（自分の Gmail）に更新

- [ ] **Step 2: デプロイ**

```bash
cd "C:/Users/biscu/Downloads/bluesky-camp" && git push origin main && npx vercel --prod 2>&1 | tail -4
```
Expected: `Aliased: https://bluesky-camp.vercel.app`

- [ ] **Step 3: 実送信テスト（ユーザー）**

本番でテスト予約を1件作成 → お客様確認メールとオーナー通知メールが Gmail 経由で届くことを確認。届いたらテスト予約は管理画面から削除。
