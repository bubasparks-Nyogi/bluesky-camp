# メール送信を Gmail SMTP に切替 設計書

> 作成: 2026-05-20
> 対象: @blueSky 予約サイト（Next.js 14 / Supabase / TypeScript）
> 目的: 予約・キャンセル等の通知メールを Resend（認証ドメイン無しで実際に届いていない）から、無料 Gmail SMTP 送信に切り替えて確実に届くようにする。

---

## 背景
- 現状 `lib/email.ts` が `resend` SDK でメール送信、HTML は `@react-email/components` のテンプレートで生成。
- Resend に認証済みドメインが無く、送信元 `noreply@bluesky-camp.jp` からは**実際には送信できていない**（予約完了・オーナー通知・キャンセル通知が届かない）。
- ログインのマジックリンクは別系統（Supabase Auth）で、既に Gmail SMTP に設定済み・稼働中。

## 方針
- **送信トランスポートのみ** `nodemailer` + Gmail SMTP に差し替える。
- **React Email テンプレート（HTML 生成）はそのまま流用** — メールの見た目は不変。
- 送信元は Gmail アドレス固定（Gmail は認証アカウント以外の From を許可しないため）。
- `RESEND_*` への依存は撤去（コードから Resend 呼び出しを除去）。

## 環境変数
| 変数 | 用途 | 例 |
|------|------|----|
| `GMAIL_USER` | 送信元 Gmail（SMTP ユーザー兼 From）| `bubasparks80262147@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail アプリパスワード（16桁）| （秘密・ユーザーが設定）|
| `OWNER_EMAIL` | オーナー通知の宛先（**実在アドレスに変更**）| 自分の Gmail |
| `NEXT_PUBLIC_SITE_URL` | 既存（メール内リンク用）| 変更なし |

- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` は不要になる（残してもよいが未使用）。

## 実装

### `lib/mailer.ts`（新規・トランスポート）
- `nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })`
- `sendMail({ to, subject, html })` を1つ公開。From は `"@blueSky <GMAIL_USER>"`。
- `GMAIL_USER` か `GMAIL_APP_PASSWORD` 未設定なら、送信をスキップしてログ警告（落とさない＝既存の best-effort 思想と同じ）。

### `lib/email.ts`（改修）
- `import { Resend }` と `resend.emails.send(...)` を撤去し、`@/lib/mailer` の `sendMail` に置換。
- 既存の関数シグネチャ（`sendReservationEmails` / `sendReservationConfirmedEmail` / `sendCancellationEmails`）と React Email テンプレートの `render()` は維持。
- 送信先・件名・HTML の組み立てロジックはそのまま。`from` 引数は不要に（mailer が From を持つ）。

### 依存
- `npm install nodemailer` ＋ `npm install -D @types/nodemailer`。

## テスト方針
- 送信トランスポートは外部依存のためユニットテストせず、本番で実送信確認（予約を1件作る or テスト送信）。
- 既存テストが壊れないこと（`npx vitest run` 全 pass）と型チェックを確認。

## 非対象
- メールテンプレートのデザイン変更（流用のみ）。
- Supabase Auth（マジックリンク）側の設定（既に Gmail SMTP 済み）。
- 独自ドメイン化（将来 `RESEND_FROM_EMAIL`＋ドメイン認証に戻すのはいつでも可能）。

## デプロイ・設定手順（実装後）
1. Vercel に `GMAIL_USER`、`GMAIL_APP_PASSWORD` を設定、`OWNER_EMAIL` を実在 Gmail に更新（ユーザー操作）。
2. デプロイ。
3. テスト予約 or テスト送信でオーナー通知・お客様確認が届くことを確認。
