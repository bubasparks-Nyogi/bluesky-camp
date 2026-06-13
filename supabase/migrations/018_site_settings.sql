-- supabase/migrations/018_site_settings.sql
-- 営業情報（チェックイン時間・住所・電話 等）を管理画面で編集可能にするための単一行テーブル

CREATE TABLE IF NOT EXISTS site_settings (
  id            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  checkin_time  text NOT NULL DEFAULT '',
  checkout_time text NOT NULL DEFAULT '',
  address       text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  guide_note    text NOT NULL DEFAULT '',
  updated_at    timestamptz DEFAULT now()
);

INSERT INTO site_settings (id, checkin_time, checkout_time, address, phone, guide_note)
VALUES (
  1,
  '12:00 〜 17:00',
  '10:00 まで',
  '滋賀県高島市安曇川町川島1478-5',
  '090-6556-8224',
  ''
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
