-- supabase/migrations/016_line_integration.sql
-- B-7a: LINE binding + message storage

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS line_user_id text;
CREATE INDEX IF NOT EXISTS idx_reservations_line_user_id ON reservations(line_user_id)
  WHERE line_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS line_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  uuid REFERENCES reservations(id) ON DELETE SET NULL,
  line_user_id    text NOT NULL,
  line_message_id text UNIQUE,
  sender          text NOT NULL CHECK (sender IN ('customer','owner','system')),
  message_type    text NOT NULL,
  text            text,
  raw_event       jsonb NOT NULL,
  received_at     timestamptz NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_messages_reservation ON line_messages(reservation_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_messages_user        ON line_messages(line_user_id,    received_at DESC);
ALTER TABLE line_messages ENABLE ROW LEVEL SECURITY;
