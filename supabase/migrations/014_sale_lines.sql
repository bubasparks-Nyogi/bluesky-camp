-- supabase/migrations/014_sale_lines.sql
CREATE TABLE sale_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL REFERENCES items(id),
  item_name      text NOT NULL,
  unit_price     integer NOT NULL,
  quantity       numeric NOT NULL CHECK (quantity > 0),
  occurred_at    date NOT NULL,
  note           text,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_sale_lines_reservation ON sale_lines (reservation_id);
ALTER TABLE sale_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE receipt_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  type           text NOT NULL,
  sent_to        text NOT NULL,
  total_amount   integer NOT NULL,
  trigger        text NOT NULL,
  sent_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_receipt_logs_reservation ON receipt_logs (reservation_id, type);
ALTER TABLE receipt_logs ENABLE ROW LEVEL SECURITY;
