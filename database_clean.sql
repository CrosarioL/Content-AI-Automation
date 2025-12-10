-- Content Generator Database Schema
-- Copy everything below this line and paste into Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slide_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slide_count INTEGER NOT NULL DEFAULT 7,
  slide_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS persona_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  persona_type TEXT NOT NULL CHECK (persona_type IN ('main', 'male', 'female')),
  slide_template_id UUID REFERENCES slide_templates(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(idea_id, persona_type)
);

CREATE TABLE IF NOT EXISTS country_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_variant_id UUID NOT NULL REFERENCES persona_variants(id) ON DELETE CASCADE,
  country TEXT NOT NULL CHECK (country IN ('uk', 'us', 'ksa', 'my')),
  day_number INTEGER CHECK (day_number >= 1 AND day_number <= 5),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(persona_variant_id, country, day_number)
);

CREATE TABLE IF NOT EXISTS slide_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_variant_id UUID NOT NULL REFERENCES country_variants(id) ON DELETE CASCADE,
  slide_number INTEGER NOT NULL CHECK (slide_number >= 1),
  slide_type TEXT NOT NULL,
  content TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_variant_id, slide_number)
);

CREATE TABLE IF NOT EXISTS slide_text_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slide_id UUID NOT NULL REFERENCES slide_contents(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  content TEXT NOT NULL,
  layout_config JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slide_image_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slide_id UUID NOT NULL REFERENCES slide_contents(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  aspect_ratio TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS render_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  persona_type TEXT NOT NULL CHECK (persona_type IN ('main', 'male', 'female')),
  country TEXT NOT NULL CHECK (country IN ('uk', 'us', 'ksa', 'my')),
  template_id UUID REFERENCES slide_templates(id),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'encoding', 'uploading', 'complete', 'failed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  batch_id TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  output_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idea_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_persona_variants_idea_id ON persona_variants(idea_id);
CREATE INDEX IF NOT EXISTS idx_country_variants_persona_variant_id ON country_variants(persona_variant_id);
CREATE INDEX IF NOT EXISTS idx_slide_contents_country_variant_id ON slide_contents(country_variant_id);
CREATE INDEX IF NOT EXISTS idx_slide_text_variants_slide_id ON slide_text_variants(slide_id);
CREATE INDEX IF NOT EXISTS idx_slide_image_variants_slide_id ON slide_image_variants(slide_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_idea_id ON render_jobs(idea_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status);
CREATE INDEX IF NOT EXISTS idx_render_jobs_batch_id ON render_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_idea_images_idea_id ON idea_images(idea_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ideas_updated_at BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_render_jobs_updated_at BEFORE UPDATE ON render_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO slide_templates (id, name, slide_count, slide_definitions)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default 7-Slide Template',
  7,
  '[
    {"slide_number": 1, "type": "hook", "label": "Hook"},
    {"slide_number": 2, "type": "problem", "label": "Problem"},
    {"slide_number": 3, "type": "agitation", "label": "Agitation"},
    {"slide_number": 4, "type": "solution", "label": "Solution"},
    {"slide_number": 5, "type": "benefit", "label": "Benefit"},
    {"slide_number": 6, "type": "proof", "label": "Proof"},
    {"slide_number": 7, "type": "cta", "label": "Call to Action"}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;

