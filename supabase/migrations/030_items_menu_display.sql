-- supabase/migrations/030_items_menu_display.sql
-- 商品・メニューをホームページの「メニュー」セクションに掲載するための状態管理

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS display_status text NOT NULL DEFAULT 'available'
    CHECK (display_status IN ('available', 'sold_out', 'coming_soon')),
  ADD COLUMN IF NOT EXISTS on_menu_display boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN items.display_status   IS 'available=販売中 / sold_out=売り切れ / coming_soon=準備中';
COMMENT ON COLUMN items.on_menu_display  IS 'true=ホームページのメニューセクションに掲載する（常備品）';

CREATE INDEX IF NOT EXISTS idx_items_on_menu ON items (on_menu_display) WHERE on_menu_display = true;
