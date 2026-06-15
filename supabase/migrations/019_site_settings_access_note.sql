-- supabase/migrations/019_site_settings_access_note.sql
-- アクセス案内（電車・車・周辺観光）の編集可能テキスト

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS access_note text NOT NULL DEFAULT '';
