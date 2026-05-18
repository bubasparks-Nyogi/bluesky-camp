-- supabase/migrations/006_phase13.sql

CREATE TABLE posts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        UNIQUE NOT NULL,
  title        text        NOT NULL,
  excerpt      text,
  body         text        NOT NULL,
  cover_image  text,
  category     text        NOT NULL DEFAULT 'news',
  is_published boolean     NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_posts_slug         ON posts (slug);
CREATE INDEX idx_posts_is_published ON posts (is_published);
CREATE INDEX idx_posts_published_at ON posts (published_at DESC);
CREATE INDEX idx_posts_category     ON posts (category);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_read_published" ON posts FOR SELECT USING (is_published = true);
