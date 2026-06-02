-- supabase/migrations/011_journal_receipt.sql
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS receipt_url text;
