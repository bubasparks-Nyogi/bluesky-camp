-- supabase/migrations/031_electronic_money_account.sql
-- 電子マネー（前払残高）勘定を追加
-- PayPayマネー・Suica・nanaco 等のチャージ済み残高を管理する

INSERT INTO accounts (code, name, category, normal_balance, sort_order)
VALUES ('106', '電子マネー', 'asset', 'debit', 22)
ON CONFLICT (code) DO NOTHING;

COMMENT ON COLUMN accounts.name IS '勘定科目名。106=電子マネー は前払残高（現金・預金と同じ資産）';
