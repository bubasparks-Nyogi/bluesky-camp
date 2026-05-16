-- supabase/migrations/004_phase9.sql

-- 写真管理テーブル
CREATE TABLE photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url        text NOT NULL,
  caption    text,
  section    text NOT NULL CHECK (section IN ('hero', 'facilities')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_photos_section ON photos (section);
CREATE INDEX idx_photos_sort    ON photos (section, sort_order);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos_read"   ON photos FOR SELECT USING (true);
CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "photos_update" ON photos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (auth.role() = 'authenticated');

-- FAQ管理テーブル
CREATE TABLE faqs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question     text NOT NULL,
  answer       text NOT NULL,
  category     text NOT NULL DEFAULT 'general'
                 CHECK (category IN ('general','pricing','access','facility')),
  sort_order   integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_faqs_category     ON faqs (category);
CREATE INDEX idx_faqs_is_published ON faqs (is_published);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faqs_read"   ON faqs FOR SELECT USING (true);
CREATE POLICY "faqs_insert" ON faqs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "faqs_update" ON faqs FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "faqs_delete" ON faqs FOR DELETE USING (auth.role() = 'authenticated');
