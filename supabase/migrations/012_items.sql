-- supabase/migrations/012_items.sql
CREATE TABLE items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL,
  unit            text NOT NULL DEFAULT '個',
  sale_price      integer,
  cost_price      integer,
  is_sellable     boolean NOT NULL DEFAULT true,
  track_inventory boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_items_category ON items (category);
CREATE INDEX idx_items_active   ON items (is_active);

CREATE TABLE item_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id    uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  component_item_id uuid NOT NULL REFERENCES items(id),
  quantity          numeric NOT NULL CHECK (quantity > 0),
  UNIQUE (parent_item_id, component_item_id)
);
CREATE INDEX idx_item_components_parent ON item_components (parent_item_id);

ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_components ENABLE ROW LEVEL SECURITY;
