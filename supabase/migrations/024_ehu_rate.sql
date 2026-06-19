-- supabase/migrations/024_ehu_rate.sql
-- EHU（電源使用料）の単価を site_settings で管理（管理画面から変更可）
-- + items テーブルに「EHU使用料」アイテムを seed

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ehu_rate integer NOT NULL DEFAULT 50;

-- EHU使用料アイテム（id を deterministic にして冪等性確保）
INSERT INTO items (name, category, unit, sale_price, cost_price, is_sellable, track_inventory, is_active, sort_order)
SELECT 'EHU使用料', 'service', 'kWh', 50, 32, true, false, true, 100
WHERE NOT EXISTS (SELECT 1 FROM items WHERE name = 'EHU使用料');
