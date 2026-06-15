-- supabase/migrations/020_pricing_rules.sql
-- 連泊割引（単一値）と季節料金（期間別倍率）

CREATE TABLE IF NOT EXISTS pricing_settings (
  id                        integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  multi_night_discount_rate numeric NOT NULL DEFAULT 0
    CHECK (multi_night_discount_rate >= 0 AND multi_night_discount_rate < 1),
  updated_at                timestamptz DEFAULT now()
);

INSERT INTO pricing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS seasonal_rates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL CHECK (end_date >= start_date),
  multiplier  numeric NOT NULL CHECK (multiplier > 0),
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seasonal_rates_date ON seasonal_rates(start_date, end_date);

ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_rates   ENABLE ROW LEVEL SECURITY;
