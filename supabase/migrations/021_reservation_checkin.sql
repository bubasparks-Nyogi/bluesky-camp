-- supabase/migrations/021_reservation_checkin.sql
-- チェックイン完了時刻の記録（オーナーが当日 QR をスキャンしてセット）

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_reservations_checked_in ON reservations(checked_in_at)
  WHERE checked_in_at IS NOT NULL;
