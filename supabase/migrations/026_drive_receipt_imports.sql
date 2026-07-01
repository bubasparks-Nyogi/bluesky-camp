-- supabase/migrations/026_drive_receipt_imports.sql
-- Google Drive から取り込んだレシートの記録（二重計上防止）

CREATE TABLE IF NOT EXISTS drive_receipt_imports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text UNIQUE NOT NULL,
  file_name     text NOT NULL,
  receipt_path  text,
  imported_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE drive_receipt_imports ENABLE ROW LEVEL SECURITY;
