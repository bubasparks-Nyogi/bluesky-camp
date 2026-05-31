# @blueSky 予約サイト 運用手順書

> 責任者向け・正式運用マニュアル
> 最終更新: 2026-05-20 / 対象サイト: https://bluesky-camp.vercel.app

---

## 0. このサイトの全体像（まず最初に理解すること）

```
   お客様 / オーナー
        │
        ▼
 ┌──────────────────┐     ┌──────────────────┐
 │   Vercel          │────▶│   Supabase        │
 │ (サイト本体/公開)  │     │ (DB・認証・画像)   │
 └──────────────────┘     └──────────────────┘
        │                        
        ├──▶ Resend     (予約・キャンセルのメール送信)
        ├──▶ Stripe     (決済 ※有効化した場合のみ)
        └──▶ Google     (アクセス解析 GA4)
```

| サービス | 役割 | 管理画面 |
|---------|------|---------|
| **Vercel** | サイトの公開・自動デプロイ | https://vercel.com/dashboard |
| **Supabase** | データベース・会員認証・写真保存 | https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa |
| **Resend** | メール送信 | https://resend.com/ |
| **Google Analytics** | アクセス解析（ID: G-4Q4Z3QWMX0）| https://analytics.google.com/ |
| **GitHub** | ソースコード保管 | https://github.com/bubasparks-Nyogi/bluesky-camp |

**サイトの管理画面（オーナー操作）**: https://bluesky-camp.vercel.app/admin/login

---

## 1. 運用開始前チェックリスト（一度だけ）

正式に集客を始める前に、以下を全て確認してください。

- [ ] **テストデータの削除** — 開発中に入れたダミーの予約・レビュー・記事を消す（§7参照）
- [ ] **料金の最終確認** — `/admin/pricing` で基本料金、`/admin/rental-items` でレンタル料金が正しいか
- [ ] **定休日・ブロック日の登録** — `/admin/blocked-dates` で営業しない日を登録
- [ ] **メール送信テスト** — 自分のメールで予約を1件作り、確認メールが届くか確認（届いたら予約は削除）
- [ ] **オーナー通知先メールの確認** — 環境変数 `OWNER_EMAIL` が正しいか（予約が入った時にここへ届く）
- [ ] **写真の登録** — `/admin/photos` でヒーロー画像・施設写真を本物に差し替え
- [ ] **FAQ の登録** — `/admin/faqs` でよくある質問を用意
- [ ] **オープン告知記事** — `/admin/posts` で「オープンしました」記事を1本公開
- [ ] **スマホ表示確認** — 実機で予約フローが最後まで通るか
- [ ] **会員ログイン確認** — `/auth/login` でマジックリンクが届きログインできるか

---

## 2. 日常運用

### 2-1. 予約が入ったとき（最重要フロー）

1. **オーナー宛メールが届く**（件名: `【新規予約】XXXXXXXX - お客様名 様`）
2. `/admin/reservations` を開いて予約内容を確認
3. お客様へ電話 or メールで受付連絡（必要に応じて）
4. 問題なければステータスを **「確定」** に変更
5. 受け入れできない場合は **「キャンセル」** に変更（お客様にキャンセル確認メールが自動送信される）

> 💡 予約の検索: 名前・メール・電話番号で検索バーから絞り込み可能。日付範囲・ステータスでもフィルタできる。

### 2-2. レビューが投稿されたとき

1. お客様がサイト下部「✏️ クチコミを書く」から投稿
2. `/admin/reviews` に **「未承認」** として表示される
3. 内容を確認（不適切でないか）
4. 問題なければ **「承認する」** → トップページに公開される
5. 不適切なら **「削除」**

### 2-3. お知らせ・ブログを投稿するとき

1. `/admin/posts` → **「+ 新規作成」**
2. タイトル・カテゴリ（お知らせ / イベント / ブログ）・本文（Markdown）を入力
3. **「公開する」** にチェック → 作成
4. トップと `/news` に最大60秒で反映される

> Markdown の書き方: `## 見出し`、`- 箇条書き`、`**太字**`、`[リンク](URL)`、`![画像](画像URL)`

---

## 3. 定期メンテナンス

| 頻度 | 作業 |
|------|------|
| **毎日** | 新規予約メールの確認、`/admin/reservations` のチェック |
| **週1** | 未承認レビューの確認・承認、翌週以降のブロック日確認 |
| **月1** | DB バックアップ（§5）、GA でアクセス傾向の確認、料金の見直し |
| **年1** | ドメイン更新（独自ドメイン取得時）、各サービスの請求確認、利用規約・ルールの見直し |

---

## 4. アカウント・パスワード管理（厳重に）

以下の情報は**パスワード管理アプリ（1Password / Bitwarden 等）に保管**し、紙のメモやメール本文には残さないこと。

| 項目 | 内容 | 保管場所 |
|------|------|---------|
| Google アカウント | サイト管理者ログイン | ____ |
| Supabase ログイン | DB 管理 | ____ |
| Supabase DB パスワード | 緊急時の直接接続用 | ____ |
| Vercel ログイン | デプロイ管理 | ____ |
| Resend API キー | メール送信 | 環境変数に設定済み |
| GitHub アカウント | ソースコード | ____ |

> ⚠️ **API キーやパスワードを絶対にやってはいけないこと**
> - チャットアプリやメールに貼り付けない
> - GitHub の公開リポジトリにコミットしない（`.env.local` は `.gitignore` 済み）
> - 第三者に画面共有で見せない

---

## 5. バックアップ

### 5-1. データベースのバックアップ（月1推奨）

Supabase の無料プランでも手動バックアップが可能:

1. https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa を開く
2. 左メニュー **Database** → **Backups**
3. 自動バックアップの有無を確認（有料プランは日次自動バックアップあり）
4. 重要データは手動でエクスポート:
   - **Table Editor** で各テーブルを開く → **Export** → CSV ダウンロード
   - 最低限バックアップすべきテーブル: `reservations`, `profiles`, `reviews`, `posts`

### 5-2. ソースコードのバックアップ

GitHub に自動保管されているため追加作業は不要。`main` ブランチが最新の本番コード。

---

## 6. 障害対応

### 6-1. 「サイトが表示されない」

1. https://www.vercel-status.com/ で Vercel 自体の障害か確認
2. Vercel Dashboard → bluesky-camp → **Deployments** で最新デプロイが「Ready」か確認
3. 直近のデプロイが失敗（赤）の場合 → 一つ前の成功デプロイを **「Promote to Production」** で復旧（ロールバック）

### 6-2. 「予約メールが届かない」

1. https://resend.com/ にログイン → **Logs** で送信履歴を確認
2. 送信エラーが出ている場合 → API キーの有効期限・送信ドメイン認証を確認
3. お客様の迷惑メールフォルダに入っている可能性も案内

### 6-3. 「会員ログインできない / マジックリンクが変なところへ飛ぶ」

1. Supabase Dashboard → **Authentication** → **URL Configuration** を確認
2. **Site URL** が `https://bluesky-camp.vercel.app` になっているか
3. **Redirect URLs** に `https://bluesky-camp.vercel.app/**` が含まれているか

### 6-4. 「予約が二重に入った」

- システムは同一チェックイン日の重複予約を自動で拒否する設計だが、念のため `/admin/reservations` で重複確認
- 不要な方を「キャンセル」に変更

### 6-5. 緊急連絡先

| 状況 | 連絡先 |
|------|--------|
| サイトの不具合・機能追加 | （開発担当者の連絡先を記入）____ |
| Vercel の障害 | https://vercel.com/help |
| Supabase の障害 | https://supabase.com/support |

---

## 7. テストデータの削除手順

開発中に入れたダミーデータを消す場合（正式オープン前に一度実施）:

1. **レビュー**: `/admin/reviews` で「田中 太郎」等のテストレビューを削除
2. **記事**: `/admin/posts` で不要なテスト記事を削除
3. **予約**: `/admin/reservations` でテスト予約を確認（既にAPI経由のテストは削除済み）

> 本物の予約データは絶対に消さないこと。判断に迷ったら開発担当者に相談。

---

## 8. コスト管理

現在の構成は**ほぼ無料**で運用可能。

| サービス | 無料枠 | 超過時 |
|---------|-------|--------|
| Vercel | 個人利用は無料（商用は Pro $20/月 推奨）| トラフィック増で課金 |
| Supabase | 無料枠（DB 500MB、月5万行）| 超過で Pro $25/月 |
| Resend | 月3,000通まで無料 | 超過で課金 |
| Google Analytics | 無料 | — |

> 💡 月の予約件数が数十件程度なら無料枠で十分。アクセスが急増したら Vercel/Supabase のダッシュボードで使用量を確認。

---

## 9. 変更・機能追加をしたいとき

このサイトはコードで管理されているため、見た目や機能の変更は開発担当者に依頼します。依頼時は以下を伝えると早い:

- **どのページの**（例: トップページの料金セクション）
- **何を**（例: 「連泊割引」を追加したい）
- **どうしたい**（例: 3泊以上で5%引き）

軽微なテキスト・料金・写真・記事の変更は**管理画面から自分で**できます（コード変更不要）。

---

## 10. クイックリンク集

| やりたいこと | URL |
|------------|-----|
| 予約を確認 | https://bluesky-camp.vercel.app/admin/reservations |
| 料金を変更 | https://bluesky-camp.vercel.app/admin/pricing |
| レンタル品を変更 | https://bluesky-camp.vercel.app/admin/rental-items |
| 休業日を登録 | https://bluesky-camp.vercel.app/admin/blocked-dates |
| 写真を変更 | https://bluesky-camp.vercel.app/admin/photos |
| FAQを編集 | https://bluesky-camp.vercel.app/admin/faqs |
| レビューを承認 | https://bluesky-camp.vercel.app/admin/reviews |
| 記事を投稿 | https://bluesky-camp.vercel.app/admin/posts |
| アクセス解析 | https://analytics.google.com/ |
| サイトの稼働状況 | https://vercel.com/dashboard |
| データベース | https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa |
