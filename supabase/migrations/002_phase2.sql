-- reservations テーブルへのカラム追加
ALTER TABLE reservations
  ADD COLUMN agreed_to_terms_at TIMESTAMPTZ;

-- blocked_dates テーブル作成
CREATE TABLE blocked_dates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE NOT NULL UNIQUE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- anon は読み取りのみ（空き確認APIが参照する）
CREATE POLICY "blocked_dates_read" ON blocked_dates FOR SELECT USING (TRUE);
