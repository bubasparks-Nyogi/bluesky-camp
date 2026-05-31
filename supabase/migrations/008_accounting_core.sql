-- supabase/migrations/008_accounting_core.sql

CREATE TABLE accounts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text        NOT NULL UNIQUE,
  name           text        NOT NULL,
  category       text        NOT NULL,
  normal_balance text        NOT NULL,
  is_active      boolean     NOT NULL DEFAULT true,
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_accounts_category ON accounts (category);
CREATE INDEX idx_accounts_active   ON accounts (is_active);

CREATE TABLE journal_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  date        NOT NULL,
  description text        NOT NULL DEFAULT '',
  source      text        NOT NULL DEFAULT 'manual',
  source_id   text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_journal_entries_date   ON journal_entries (entry_date);
CREATE INDEX idx_journal_entries_source ON journal_entries (source, source_id);

CREATE TABLE journal_lines (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid    NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       uuid    NOT NULL REFERENCES accounts(id),
  side             text    NOT NULL,
  amount           integer NOT NULL CHECK (amount > 0),
  tax_category     text,
  line_order       integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_journal_lines_entry   ON journal_lines (journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines (account_id);

CREATE TABLE opening_balances (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year  integer NOT NULL,
  account_id   uuid    NOT NULL REFERENCES accounts(id),
  side         text    NOT NULL,
  amount       integer NOT NULL CHECK (amount >= 0),
  UNIQUE (fiscal_year, account_id)
);
CREATE INDEX idx_opening_balances_year ON opening_balances (fiscal_year);

ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_balances ENABLE ROW LEVEL SECURITY;

INSERT INTO accounts (code, name, category, normal_balance, sort_order) VALUES
  ('101', '現金',         'asset',     'debit',  10),
  ('102', '普通預金',     'asset',     'debit',  20),
  ('103', '売掛金',       'asset',     'debit',  30),
  ('104', '前払金',       'asset',     'debit',  40),
  ('151', '工具器具備品', 'asset',     'debit',  50),
  ('152', '建物',         'asset',     'debit',  60),
  ('153', '車両運搬具',   'asset',     'debit',  70),
  ('201', '買掛金',       'liability', 'credit', 110),
  ('202', '未払金',       'liability', 'credit', 120),
  ('203', '前受金',       'liability', 'credit', 130),
  ('204', '預り金',       'liability', 'credit', 140),
  ('211', '借入金',       'liability', 'credit', 150),
  ('301', '元入金',       'equity',    'credit', 210),
  ('302', '事業主貸',     'equity',    'debit',  220),
  ('303', '事業主借',     'equity',    'credit', 230),
  ('401', '売上高',       'revenue',   'credit', 310),
  ('402', '雑収入',       'revenue',   'credit', 320),
  ('501', '仕入高',       'expense',   'debit',  410),
  ('511', '租税公課',     'expense',   'debit',  420),
  ('512', '水道光熱費',   'expense',   'debit',  430),
  ('513', '旅費交通費',   'expense',   'debit',  440),
  ('514', '通信費',       'expense',   'debit',  450),
  ('515', '広告宣伝費',   'expense',   'debit',  460),
  ('516', '接待交際費',   'expense',   'debit',  470),
  ('517', '損害保険料',   'expense',   'debit',  480),
  ('518', '修繕費',       'expense',   'debit',  490),
  ('519', '消耗品費',     'expense',   'debit',  500),
  ('520', '減価償却費',   'expense',   'debit',  510),
  ('521', '福利厚生費',   'expense',   'debit',  520),
  ('522', '給料賃金',     'expense',   'debit',  530),
  ('523', '外注工賃',     'expense',   'debit',  540),
  ('524', '利子割引料',   'expense',   'debit',  550),
  ('525', '地代家賃',     'expense',   'debit',  560),
  ('526', '支払手数料',   'expense',   'debit',  570),
  ('530', '雑費',         'expense',   'debit',  580);
