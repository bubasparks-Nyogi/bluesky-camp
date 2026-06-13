-- supabase/migrations/017_sale_drafts.sql
-- B-7b: AI extraction draft table

CREATE TABLE IF NOT EXISTS sale_drafts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id          uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  source_line_message_id  uuid NOT NULL REFERENCES line_messages(id) ON DELETE CASCADE,
  item_id                 uuid REFERENCES items(id),
  item_name_raw           text NOT NULL,
  unit_price              integer,
  quantity                numeric NOT NULL CHECK (quantity > 0),
  occurred_at             date NOT NULL,
  confidence              numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  status                  text NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  approved_sale_line_id   uuid REFERENCES sale_lines(id) ON DELETE SET NULL,
  rejected_reason         text,
  raw_extraction          jsonb NOT NULL,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_drafts_reservation_pending
  ON sale_drafts(reservation_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sale_drafts_pending_all
  ON sale_drafts(created_at DESC)
  WHERE status = 'pending';

ALTER TABLE sale_drafts ENABLE ROW LEVEL SECURITY;
