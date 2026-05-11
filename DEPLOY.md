# @blueSky デプロイ手順

## 1. Supabase セットアップ
1. [supabase.com](https://supabase.com) でプロジェクト作成
2. SQL Editor で `supabase/migrations/001_initial_schema.sql` を実行
3. SQL Editor で `supabase/seed.sql` を実行
4. Settings → API から URL と ANON KEY をコピー

## 2. Stripe セットアップ
1. [dashboard.stripe.com](https://dashboard.stripe.com) でアカウント作成
2. テストモードの公開可能キーとシークレットキーをコピー
3. Webhooks → Add endpoint: `https://<your-domain>/api/webhook/stripe`
4. イベント: `payment_intent.succeeded` を選択
5. Webhook署名シークレットをコピー

## 3. Resend セットアップ
1. [resend.com](https://resend.com) でアカウント作成
2. API Key を作成してコピー
3. 送信元ドメインを設定（または onboarding@resend.dev でテスト）

## 4. LINE Messaging API セットアップ
1. LINE Developers でチャンネル作成（Messaging API）
2. チャンネルアクセストークン（長期）を発行
3. オーナーのLINE User IDを取得

## 5. Vercel デプロイ
1. GitHub にリポジトリをプッシュ
2. [vercel.com/new](https://vercel.com/new) でリポジトリをインポート
3. Environment Variables に `.env.example` の全キーを実際の値で設定
4. Deploy ボタンをクリック

## 6. 本番化チェックリスト
- [ ] Supabase DB にデータが入っている
- [ ] Stripe の本番キーに切り替え（準備できたら）
- [ ] 独自ドメインを Vercel に設定
- [ ] Stripe Webhook URL を本番ドメインに更新
- [ ] LINE Webhook URL を設定
- [ ] テスト予約を1件実行して通知を確認
