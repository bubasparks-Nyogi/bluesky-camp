# Phase 9: フロント強化 設計書

## 概要

Phase 9 では @blueSky サイトのゲスト体験向上を目的に、以下の3機能を追加する。

1. **写真スライドショー** — トップページ Hero / Facilities 両セクションに管理画面からアップロードした写真を動的表示
2. **FAQ 管理** — 管理画面で Q&A を追加・編集・削除・並び替え、トップページに表示
3. **天気予報** — チェックイン日の天気予報を予約確認画面（StepConfirm）と予約確認メールの両方に表示

---

## アーキテクチャ

### 技術スタック（既存を継続）
- Next.js 14 App Router
- Supabase（DB + Storage）
- TailwindCSS（warm パレット）
- Resend / react-email（メール）
- TypeScript

### データ設計（新規テーブル 2 つ）

```sql
-- 写真管理
CREATE TABLE photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url          text NOT NULL,          -- Supabase Storage の公開URL
  caption      text,                   -- キャプション（任意）
  section      text NOT NULL,          -- 'hero' | 'facilities'
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- FAQ管理
CREATE TABLE faqs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question     text NOT NULL,
  answer       text NOT NULL,
  category     text NOT NULL DEFAULT 'general', -- 'general' | 'pricing' | 'access' | 'facility'
  sort_order   integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
```

Supabase Storage バケット: `photos`（public アクセス可）

---

## 機能仕様

### 1. 写真スライドショー

**表示箇所**
- `components/home/Hero.tsx` — Hero背景またはオーバーレイスライドショー（3〜5秒自動切り替え）
- `components/home/Facilities.tsx` — 施設紹介セクション内スライドショー

**データフロー**
1. `app/page.tsx`（Server Component）で `photos` テーブルから section 別に取得
2. Client Component `PhotoSlider.tsx` に渡してオートプレイ表示
3. 写真が0枚の場合は既存の静的デザインにフォールバック

**管理機能**
- `/admin/photos` ページを新設
- Supabase Storage にアップロード → URL を `photos` テーブルに保存
- Hero / Facilities のセクション選択
- ドラッグ不要のシンプルな「↑↓」ボタンで並び替え
- 削除（Storage + DB 両方から削除）

**API エンドポイント**
- `GET  /api/photos?section=hero` — 公開用
- `GET  /api/admin/photos` — 管理用一覧
- `POST /api/admin/photos` — アップロード（multipart/form-data）
- `PATCH /api/admin/photos/[id]` — sort_order 更新
- `DELETE /api/admin/photos/[id]` — 削除

### 2. FAQ 管理

**表示箇所**
- トップページ最下部（Contact セクションの上）に `FaqSection.tsx` を追加
- アコーディオン形式（Q をクリックで A が開く）
- カテゴリ別タブ切り替え（general / pricing / access / facility）

**データフロー**
1. `app/page.tsx` で `faqs` テーブルから `is_published=true` のものを取得
2. `FaqSection` に渡して表示

**管理機能**
- `/admin/faqs` ページを新設
- Q・A・カテゴリ・公開/非公開・並び順を編集
- 追加・削除・並び替え（↑↓ボタン）

**API エンドポイント**
- `GET  /api/faqs` — 公開用（is_published=true のみ）
- `GET  /api/admin/faqs` — 管理用全件
- `POST /api/admin/faqs` — 追加
- `PATCH /api/admin/faqs/[id]` — 更新
- `DELETE /api/admin/faqs/[id]` — 削除

### 3. 天気予報

**表示箇所**
1. `components/reserve/StepConfirm.tsx` — チェックイン日の天気・最高/最低気温を表示
2. `emails/ReservationConfirm.tsx` — 予約確認メールにも同内容を追加

**天気APIに使用するサービス**
- [Open-Meteo](https://open-meteo.com/) — 無料・APIキー不要・商用利用可

**エンドポイント例**（@blueSkyの場所: 仮座標を使用、正式な緯度経度は設定ファイルに定数として管理）
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=35.6895&longitude=136.0
  &daily=weathercode,temperature_2m_max,temperature_2m_min
  &timezone=Asia/Tokyo
  &start_date=YYYY-MM-DD
  &end_date=YYYY-MM-DD
```

**天気コード → 日本語テキスト変換**
Open-Meteo の WMO 天気コード（0〜99）を「晴れ」「くもり」「雨」などに変換するマッピングを `lib/weather.ts` に定義。

**データフロー（予約確認画面）**
1. `StepConfirm` がマウント時に `GET /api/weather?date=YYYY-MM-DD` を fetch
2. API ルートが Open-Meteo を呼び出して天気データを返す
3. 取得成功なら天気アイコン + テキストを表示、失敗時は非表示（エラーは出さない）

**データフロー（メール）**
1. 予約確定後のメール送信前に `lib/weather.ts` の `getWeatherForecast(date)` を呼び出す
2. 取得した天気情報を `ReservationConfirm` テンプレートの props に追加
3. 取得失敗時はメール内の天気セクションを省略（メール送信自体は失敗させない）

**新規ファイル**
- `lib/weather.ts` — Open-Meteo API 呼び出し + 天気コード変換
- `app/api/weather/route.ts` — `GET /api/weather?date=YYYY-MM-DD`
- `components/reserve/WeatherForecast.tsx` — 天気表示UI

---

## ファイル構成（新規 + 修正）

### 新規作成
```
app/
  api/
    photos/route.ts
    admin/photos/route.ts
    admin/photos/[id]/route.ts
    admin/faqs/route.ts
    admin/faqs/[id]/route.ts
    faqs/route.ts
    weather/route.ts
  admin/
    (dashboard)/
      photos/page.tsx
      faqs/page.tsx
components/
  home/
    PhotoSlider.tsx
    FaqSection.tsx
  admin/
    PhotoManager.tsx
    FaqManager.tsx
  reserve/
    WeatherForecast.tsx
lib/
  weather.ts
supabase/migrations/
  004_phase9.sql
```

### 修正
```
app/page.tsx                          -- photos + faqs を fetch して渡す
components/home/Hero.tsx              -- PhotoSlider を組み込む
components/home/Facilities.tsx        -- PhotoSlider を組み込む
components/reserve/StepConfirm.tsx    -- WeatherForecast を組み込む
emails/ReservationConfirm.tsx         -- 天気情報 props を追加
lib/email.ts                          -- sendReservationEmails に天気データを追加
app/admin/(dashboard)/layout.tsx      -- ナビに「写真管理」「FAQ管理」を追加
```

---

## エラーハンドリング方針

- **写真0枚**: 静的デザインにフォールバック（既存Hero/Facilitiesレイアウトを維持）
- **天気API失敗**: サイレント非表示（予約フローを止めない）
- **FAQ0件**: セクションごと非表示
- **画像アップロード失敗**: エラーメッセージ表示、ロールバック（DBには書かない）

---

## セキュリティ

- 写真アップロード・FAQ編集 API は admin セッションチェック必須（既存パターン踏襲）
- Supabase Storage `photos` バケットは公開読み取り可、書き込みはサービスロールのみ
- 天気APIは公開エンドポイント（認証不要）

---

## テスト方針

- `lib/weather.ts` — 天気コード変換のユニットテスト（Vitest）
- 写真アップロード → 表示 → 削除のE2Eフロー確認
- FAQ CRUD → トップページ反映確認
- 天気API失敗時のフォールバック確認（Open-Meteoをモック）
