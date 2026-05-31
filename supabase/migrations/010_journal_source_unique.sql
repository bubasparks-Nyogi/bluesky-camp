-- supabase/migrations/010_journal_source_unique.sql
-- 自動仕訳(source_id付き)の二重計上を DB レベルで防止（手動仕訳は source_id NULL なので対象外）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_journal_entries_source
  ON journal_entries (source, source_id)
  WHERE source_id IS NOT NULL;
