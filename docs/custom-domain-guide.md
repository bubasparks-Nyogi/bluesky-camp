# カスタムドメイン設定ガイド

`bluesky-camp.vercel.app` の代わりに、独自ドメイン（例: `bluesky-camp.com` や `at-bluesky.jp`）でサイトを公開する手順です。

## 1. ドメインを取得

ドメイン登録サービスでドメインを購入。日本での主要サービス:

| 業者 | 特徴 |
|------|------|
| **お名前.com** | 国内最大手、`.com` 約1,500円/年 |
| **ムームードメイン** | GMO 系、`.jp` 取扱多い |
| **Cloudflare Registrar** | 卸値・原価、`.com` 約$10/年（要英語） |
| **Google Domains（廃止予定）** | Squarespace に移管 |

おすすめ: **Cloudflare Registrar**（安い・更新しても値上がらない・DNS 一体）

## 2. Vercel にドメインを追加

1. https://vercel.com/dashboard を開く
2. **bluesky-camp** プロジェクトをクリック
3. 上部メニューの **Settings** → 左側 **Domains**
4. **「Add」** をクリックして取得したドメインを入力（例: `bluesky-camp.com`）
5. Vercel が表示する DNS レコード（A レコードまたは CNAME）をメモ

## 3. DNS レコードを設定

ドメイン登録業者の DNS 管理画面で、Vercel から指示されたレコードを追加します。

### A レコード（ルートドメイン用）
```
Type: A
Name: @  (または空)
Value: 76.76.21.21  ← Vercel から表示される値
TTL: Auto
```

### CNAME レコード（www サブドメイン用）
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com.
TTL: Auto
```

### Cloudflare の場合の注意
Cloudflare で DNS を管理する場合、追加した A/CNAME レコードの **プロキシ（オレンジ雲）を OFF（DNS only/グレー雲）** にしてください。Vercel が SSL 証明書を発行する際にプロキシが邪魔をします。

## 4. 確認

DNS 反映には数分〜数時間かかります。Vercel Dashboard の Domains 画面で **「Valid Configuration」** と緑のチェックが付けば完了。

ブラウザで `https://bluesky-camp.com` にアクセスして表示されるか確認。

## 5. アプリ側の更新

新しいドメインで動かす場合、以下の環境変数を Vercel で更新:

```
NEXT_PUBLIC_SITE_URL=https://bluesky-camp.com
```

Vercel Dashboard → **Settings** → **Environment Variables** → `NEXT_PUBLIC_SITE_URL` の値を変更 → **Save** → **Redeploy**

## 6. Supabase Auth の URL 設定を更新

マジックリンクのリダイレクトに新ドメインを許可:

1. https://supabase.com/dashboard/project/frdiafkdjeaslhwlvfxa/auth/url-configuration
2. **Site URL** = `https://bluesky-camp.com`
3. **Redirect URLs** に `https://bluesky-camp.com/**` を追加（旧 vercel.app も残してOK）
4. **Save**

## 7. SEO への影響

- 旧ドメイン (`*.vercel.app`) に被リンクがある場合、Vercel で **「Redirect」** を設定して 301 リダイレクトされるようにする
- Google Search Console に新ドメインを登録
- `sitemap.xml` は新ドメインで自動再生成される（`SITE_URL` 環境変数を使用しているため）

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 「Valid Configuration」にならない | DNS 反映待ち。1時間後に再確認 |
| HTTPS 証明書エラー | Vercel が Let's Encrypt から自動取得。10 分以内に解決 |
| `www` だけ繋がる/繋がらない | `www` 付きと `@`（apex）の両方を Vercel に追加 |
| Cloudflare プロキシ ON で繋がらない | プロキシ OFF（グレー雲）に |
