-- supabase/migrations/025_rental_coming_soon.sql
-- レンタル道具の「準備中」状態 + 既存ラベル更新

ALTER TABLE rental_items ADD COLUMN IF NOT EXISTS is_coming_soon boolean NOT NULL DEFAULT false;

-- 料金ラベル補足
UPDATE pricing SET label = '宿泊基本料金（トレーラー1台基本料金）'
  WHERE item_key = 'base' AND label NOT LIKE '%トレーラー1台%';

-- ペット同伴の補足。pricing 行が無い場合は INSERT（無料扱い、表示用）
INSERT INTO pricing (item_key, label, amount, active)
SELECT 'pet', 'ペット同伴（小型犬、複数頭は要相談）', 0, true
WHERE NOT EXISTS (SELECT 1 FROM pricing WHERE item_key = 'pet');

UPDATE pricing SET label = 'ペット同伴（小型犬、複数頭は要相談）'
  WHERE item_key = 'pet' AND label NOT LIKE '%小型犬%';
