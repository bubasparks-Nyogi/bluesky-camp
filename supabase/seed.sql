-- supabase/seed.sql
-- Supabase SQL Editor で実行してシードデータを投入する

INSERT INTO pricing (item_key, label, amount) VALUES
  ('base',     '基本宿泊料金',       40000),
  ('ehu',      'EHU外部電源',         1000),
  ('sauna',    'サウナ利用',           2000),
  ('pet',      'ペット同伴',           2000),
  ('transfer', '送迎（1名あたり）',   1000);

INSERT INTO rental_items (name, price_per_day, available) VALUES
  ('焚き火台',          500,  TRUE),
  ('アウトドアチェア',  300,  TRUE),
  ('アウトドアテーブル', 500, TRUE),
  ('ランタン',           300,  TRUE),
  ('BBQグリル',         1000,  TRUE),
  ('毛布（1枚）',        500,  TRUE);
