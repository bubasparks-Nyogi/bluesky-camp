-- supabase/migrations/005_phase12.sql

CREATE TABLE reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name   text        NOT NULL,
  rating       integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text        NOT NULL,
  visit_date   date,
  is_published boolean     NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_reviews_is_published ON reviews (is_published);
CREATE INDEX idx_reviews_created_at   ON reviews (created_at DESC);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_read_published" ON reviews FOR SELECT USING (is_published = true);
CREATE POLICY "reviews_insert"         ON reviews FOR INSERT WITH CHECK (true);
