-- supabase/migrations/028_consumption_tax.sql
-- 消費税メタデータ蓄積（Phase B: 免税事業者、税込経理維持）
-- Phase C で課税事業者移行時に、蓄積済みデータから期首/期末で仮払・仮受消費税を分離する

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0.10;
COMMENT ON COLUMN items.tax_rate IS '消費税率（0.10=10%, 0.08=軽減8%, 0=非課税）';

ALTER TABLE purchase_lines
  ADD COLUMN IF NOT EXISTS tax_rate   numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS tax_amount integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN purchase_lines.tax_rate   IS '仕入時の消費税率';
COMMENT ON COLUMN purchase_lines.tax_amount IS 'subtotal に含まれる消費税額（税込金額から逆算）';

ALTER TABLE sale_lines
  ADD COLUMN IF NOT EXISTS tax_rate   numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS tax_amount integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN sale_lines.tax_rate   IS '販売時の消費税率';
COMMENT ON COLUMN sale_lines.tax_amount IS 'unit_price×quantity に含まれる消費税額';
