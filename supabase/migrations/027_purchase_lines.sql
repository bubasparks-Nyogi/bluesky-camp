-- supabase/migrations/027_purchase_lines.sql
-- 仕入れレシート明細を記録し、商品マスタと紐付けて在庫加算する
CREATE TABLE purchase_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id  uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  item_id           uuid REFERENCES items(id),          -- 紐付けなしは NULL 可
  item_name         text NOT NULL,                       -- レシート上の表記
  quantity          numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price        integer,                             -- 単価（円）任意
  subtotal          integer NOT NULL CHECK (subtotal >= 0),
  account_code      text NOT NULL,                       -- 費用科目コード
  occurred_at       date NOT NULL,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_purchase_lines_entry ON purchase_lines (journal_entry_id);
CREATE INDEX idx_purchase_lines_item  ON purchase_lines (item_id);
CREATE INDEX idx_purchase_lines_date  ON purchase_lines (occurred_at);
ALTER TABLE purchase_lines ENABLE ROW LEVEL SECURITY;
