-- supabase/migrations/022_security_hardening.sql
-- S-5: 領収書 lookup 試行回数制限
-- S-9: 監査ログ

CREATE TABLE IF NOT EXISTS receipt_lookup_attempts (
  id             bigserial PRIMARY KEY,
  reservation_id text NOT NULL,
  attempted_at   timestamptz NOT NULL DEFAULT now(),
  succeeded      boolean NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipt_lookup_attempts_recent
  ON receipt_lookup_attempts(reservation_id, attempted_at DESC);
ALTER TABLE receipt_lookup_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS audit_logs (
  id           bigserial PRIMARY KEY,
  actor        text,                   -- user email or 'anonymous' or 'system'
  action       text NOT NULL,          -- 例: reservation.update, sale_draft.approve
  target_type  text,
  target_id    text,
  detail       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target  ON audit_logs(target_type, target_id);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
