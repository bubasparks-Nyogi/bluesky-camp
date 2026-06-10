-- supabase/migrations/015_b4_consume_and_inventory.sql

-- ① stock_movements.note 検索用インデックス
CREATE INDEX IF NOT EXISTS idx_stock_movements_note ON stock_movements (note);

-- ② 繰越商品(105) 科目を追加
INSERT INTO accounts (code, name, category, normal_balance, sort_order)
VALUES ('105', '繰越商品', 'asset', 'debit', 45)
ON CONFLICT (code) DO NOTHING;

-- ③ 期末棚卸スナップショット
CREATE TABLE inventory_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year      integer NOT NULL,
  snapshot_type    text NOT NULL,
  total_value      integer NOT NULL,
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL,
  taken_at         timestamptz DEFAULT now(),
  UNIQUE (fiscal_year, snapshot_type)
);
CREATE INDEX idx_inventory_snapshots_year ON inventory_snapshots (fiscal_year);
ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;

CREATE TABLE inventory_snapshot_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES inventory_snapshots(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES items(id),
  quantity    numeric NOT NULL,
  cost_price  integer,
  value       integer NOT NULL
);
CREATE INDEX idx_inventory_snapshot_lines_snapshot ON inventory_snapshot_lines (snapshot_id);
ALTER TABLE inventory_snapshot_lines ENABLE ROW LEVEL SECURITY;
