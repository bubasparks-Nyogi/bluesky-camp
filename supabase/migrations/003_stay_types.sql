-- 003_stay_types.sql
-- reservations テーブルへ複数宿泊タイプ列を追加

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS stay_types JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 既存データの後方互換マイグレーション（stay_type → stay_types）
UPDATE reservations
  SET stay_types = jsonb_build_array(stay_type::text)
  WHERE stay_types = '[]'::jsonb AND stay_type IS NOT NULL;

COMMENT ON COLUMN reservations.stay_types IS '選択された宿泊タイプの配列（例: ["tent","trailer_a"]）';
