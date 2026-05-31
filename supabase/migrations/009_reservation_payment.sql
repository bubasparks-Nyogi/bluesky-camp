-- supabase/migrations/009_reservation_payment.sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method text;  -- 'onsite' | 'prepaid' | NULL
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS paid_at date;          -- 入金日（事前振込のみ）
