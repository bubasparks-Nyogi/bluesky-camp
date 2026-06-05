-- supabase/migrations/013_inventory.sql
CREATE TABLE stock_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  type           text NOT NULL,
  quantity_delta numeric NOT NULL,
  note           text,
  occurred_at    date NOT NULL,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_stock_movements_item ON stock_movements (item_id);
CREATE INDEX idx_stock_movements_date ON stock_movements (occurred_at);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE items ADD COLUMN IF NOT EXISTS current_quantity numeric NOT NULL DEFAULT 0;
