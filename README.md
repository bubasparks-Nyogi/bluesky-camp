# @blueSky キャンプ場 予約サイト

滋賀県高島市の一日一組限定キャンプ場 **@blueSky** の公式予約サイト。

🔗 **本番サイト**: https://bluesky-camp.vercel.app

---

## 主な機能

### 公開サイト
- 🏕️ サイト紹介（設備・体験・料金・ルール）
- 📅 予約カレンダー（空き状況のリアルタイム表示）
- 🎯 10ステップ予約フロー（決済 Stripe 対応、未設定時は即時確定）
- ⭐ クチコミ・レビュー機能
- 📰 お知らせ・ブログ（Markdown 記事 + カテゴリフィルタ）
- 👤 会員機能（マジックリンク + リピーター 10% OFF）
- 📱 PWA（スマホでホーム画面に追加可能）

### 管理画面（`/admin/login`）
- 📋 予約一覧（検索・フィルタ・ステータス管理）
- 💴 料金マスタ管理
- 🎒 レンタル品管理
- 🚫 日程ブロック
- 📸 写真ギャラリー管理
- ❓ FAQ 管理
- ⭐ レビュー承認
- 📝 投稿管理（Markdown エディタ）

---

## 技術スタック

| | |
|---|---|
| フレームワーク | Next.js 14 App Router |
| 言語 | TypeScript |
| データベース | Supabase (PostgreSQL + Auth + Storage) |
| スタイル | TailwindCSS (warm カラーパレット) |
| 決済 | Stripe（任意） |
| メール | Resend + React Email |
| 通知 | LINE Messaging API（任意） |
| デプロイ | Vercel |
| テスト | Vitest（ユニット）+ Playwright（E2E）|

---

## 開発

### セットアップ

```bash
git clone https://github.com/bubasparks-Nyogi/bluesky-camp.git
cd bluesky-camp
npm install
cp .env.example .env.local  # 各種キーを入力
npm run dev
```

http://localhost:3000 を開く。

### 必須環境変数

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role（admin API用）|
| `RESEND_API_KEY` | メール送信 |
| `RESEND_FROM_EMAIL` | 送信元メールアドレス |
| `OWNER_EMAIL` | オーナー通知先メールアドレス |
| `NEXT_PUBLIC_SITE_URL` | 本番 URL（例: `https://bluesky-camp.vercel.app`）|

### 任意の環境変数

| 変数 | 用途 |
|------|------|
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 決済 |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 検証 |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_OWNER_USER_ID` | LINE 通知 |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics（例: `G-XXXXXXXXXX`）|

### よく使うコマンド

```bash
npm run dev               # 開発サーバー
npm run build             # 本番ビルド
npx vitest run            # ユニットテスト（77 件）
npm run test:e2e:install  # Playwright Chromium DL（初回のみ）
npm run test:e2e          # E2E テスト
npx tsc --noEmit          # TypeScript 型チェック

# 本番デプロイ
git push origin main      # 自動デプロイ（main ブランチ）
npx vercel --prod         # 手動デプロイ
```

### データベースマイグレーション

`supabase/migrations/` 配下の SQL を、新規環境の Supabase SQL Editor で順番に実行:

```
001_initial_schema.sql       基本スキーマ
002_phase2.sql                料金・レンタル品
003_stay_types.sql            複数宿泊タイプ
004_phase9.sql                写真・FAQ
005_phase12.sql               レビュー
006_phase13.sql               お知らせ・ブログ
007_phase14.sql               会員機能（profiles + auth トリガー）
```

---

## デプロイ

[Vercel](https://vercel.com) に接続済み。`main` への push で自動デプロイされます。

カスタムドメイン設定は [docs/custom-domain-guide.md](docs/custom-domain-guide.md) を参照。

---

## 運用マニュアル（オーナー向け）

### 予約が入ったら
1. `/admin/reservations` で予約一覧を確認
2. メール（オーナー宛通知）も届くので、内容に応じて連絡
3. ステータスを **「確定」** または **「キャンセル」** に変更

### お知らせを投稿
1. `/admin/login` でログイン
2. 左メニュー **📝 投稿管理** → **+ 新規作成**
3. タイトル・カテゴリ・本文（Markdown）を入力
4. **「公開する」** にチェック → 作成
5. ホームと `/news` に表示される（60秒以内に反映）

### レビューを承認
1. ゲストが `/` 下部の「✏️ クチコミを書く」から投稿
2. `/admin/reviews` に **「未承認」** で表示される
3. 内容を確認 → **「承認する」** → ホームに表示

### 料金変更
- 基本料金: `/admin/pricing`
- レンタル品: `/admin/rental-items`

### 特定日程をブロック
- `/admin/blocked-dates` で「定休日」「私用」など追加

---

## サポートドキュメント

- [カスタムドメイン設定ガイド](docs/custom-domain-guide.md)
- [Phase 別実装プラン](docs/superpowers/plans/) — 全 16 Phase の設計と実装履歴
- [仕様書](docs/superpowers/specs/) — 各機能のスペック

---

## ライセンス

このリポジトリは @blueSky の運営者専用です。
