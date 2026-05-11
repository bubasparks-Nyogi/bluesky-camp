-- supabase/migrations/001_initial_schema.sql

-- 予約ステータス
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- 宿泊タイプ
CREATE TYPE stay_type AS ENUM ('tent', 'trailer_a', 'trailer_b', 'campervan');

-- 予約テーブル
CREATE TABLE reservations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_date     DATE NOT NULL,
  checkout_date    DATE NOT NULL,
  status           reservation_status NOT NULL DEFAULT 'pending',
  stay_type        stay_type NOT NULL,
  ehu              BOOLEAN NOT NULL DEFAULT FALSE,
  sauna            BOOLEAN NOT NULL DEFAULT FALSE,
  pet              BOOLEAN NOT NULL DEFAULT FALSE,
  transfer_count   INTEGER NOT NULL DEFAULT 0,
  transfer_station TEXT,
  rental_items     JSONB NOT NULL DEFAULT '[]',
  guest_name       TEXT NOT NULL,
  guest_email      TEXT NOT NULL,
  guest_phone      TEXT NOT NULL,
  total_amount     INTEGER NOT NULL,
  stripe_payment_id TEXT,
  line_user_id     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 料金マスタ
CREATE TABLE pricing (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key TEXT NOT NULL UNIQUE,
  label    TEXT NOT NULL,
  amount   INTEGER NOT NULL,
  active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- レンタル道具マスタ
CREATE TABLE rental_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  price_per_day INTEGER NOT NULL,
  available     BOOLEAN NOT NULL DEFAULT TRUE,
  image_url     TEXT
);

-- 空き状況クエリ用インデックス
CREATE INDEX idx_reservations_dates ON reservations (checkin_date, checkout_date);
CREATE INDEX idx_reservations_status ON reservations (status);

-- RLS（Row Level Security）
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_items ENABLE ROW LEVEL SECURITY;

-- 公開読み取り: pricing, rental_items
CREATE POLICY "pricing_read" ON pricing FOR SELECT USING (TRUE);
CREATE POLICY "rental_items_read" ON rental_items FOR SELECT USING (TRUE);

-- reservations: 空き確認のみ公開（日付確認用）
CREATE POLICY "availability_read" ON reservations
  FOR SELECT USING (TRUE);
