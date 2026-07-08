-- supabase/migrations/029_drive_photo_imports.sql
-- Google Drive からの写真取込ログ（二重取込を防止）
CREATE TABLE IF NOT EXISTS drive_photo_imports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text UNIQUE NOT NULL,
  section       text NOT NULL,             -- 'hero' | 'facilities'
  file_name     text NOT NULL,
  photo_id      uuid REFERENCES photos(id) ON DELETE SET NULL,
  imported_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE drive_photo_imports ENABLE ROW LEVEL SECURITY;
