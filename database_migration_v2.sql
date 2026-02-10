-- Mass Poster v2 Migration
-- Run this in Supabase SQL Editor AFTER the original database_clean.sql

-- ============================================
-- 0. ADD ASPECT RATIO TO IDEAS TABLE
-- ============================================
-- Allows selecting canvas aspect ratio (9:16 or 3:4) per idea

ALTER TABLE ideas
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '9:16'
CHECK (aspect_ratio IN ('9:16', '3:4'));

-- ============================================
-- 1. POST INSTANCES TABLE (new)
-- ============================================
-- Represents a single generated post (1 of 7 per country per persona)

CREATE TABLE IF NOT EXISTS post_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  persona_type TEXT NOT NULL CHECK (persona_type IN ('main', 'male', 'female')),
  country TEXT NOT NULL CHECK (country IN ('uk', 'us', 'ksa', 'my')),
  post_index INTEGER NOT NULL CHECK (post_index >= 1 AND post_index <= 7),
  seed TEXT NOT NULL,
  combo_key TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'encoding', 'complete', 'failed')),
  output_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(idea_id, persona_type, country, post_index)
);

-- Index for combo_key uniqueness check within idea+persona+country
CREATE INDEX IF NOT EXISTS idx_post_instances_combo ON post_instances(idea_id, persona_type, country, combo_key);
CREATE INDEX IF NOT EXISTS idx_post_instances_status ON post_instances(status);
CREATE INDEX IF NOT EXISTS idx_post_instances_idea ON post_instances(idea_id);

-- Trigger for updated_at
CREATE TRIGGER update_post_instances_updated_at BEFORE UPDATE ON post_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. ADD SLOT TO IMAGE VARIANTS
-- ============================================
-- Allows categorizing images as 'hook', 'body', 'background', etc.

ALTER TABLE slide_image_variants 
ADD COLUMN IF NOT EXISTS slot TEXT DEFAULT 'generic' 
CHECK (slot IN ('hook', 'body', 'background', 'generic'));

-- ============================================
-- 3. ADD COUNTRY + VARIANT_INDEX TO TEXT VARIANTS
-- ============================================
-- Enables 2 text versions per country per slide

ALTER TABLE slide_text_variants
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL
CHECK (country IS NULL OR country IN ('uk', 'us', 'ksa', 'my'));

ALTER TABLE slide_text_variants
ADD COLUMN IF NOT EXISTS variant_index INTEGER DEFAULT 1
CHECK (variant_index >= 1 AND variant_index <= 2);

-- ============================================
-- 4. PERSONA SLIDES TABLE (new, simplified)
-- ============================================
-- Since we're removing country_variants during editing,
-- slides are now directly under persona_variant

CREATE TABLE IF NOT EXISTS persona_slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_variant_id UUID NOT NULL REFERENCES persona_variants(id) ON DELETE CASCADE,
  slide_number INTEGER NOT NULL CHECK (slide_number >= 1),
  slide_type TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(persona_variant_id, slide_number)
);

CREATE INDEX IF NOT EXISTS idx_persona_slides_persona_variant_id ON persona_slides(persona_variant_id);

-- ============================================
-- 5. SLIDE IMAGE POOLS TABLE (new)
-- ============================================
-- Images attached to persona_slides (not country-specific)

CREATE TABLE IF NOT EXISTS slide_image_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_slide_id UUID NOT NULL REFERENCES persona_slides(id) ON DELETE CASCADE,
  slot TEXT NOT NULL DEFAULT 'generic' CHECK (slot IN ('hook', 'body', 'background', 'generic')),
  storage_path TEXT NOT NULL,
  variant_label TEXT,
  caption TEXT,
  aspect_ratio TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slide_image_pools_slide_id ON slide_image_pools(persona_slide_id);

-- ============================================
-- 6. SLIDE TEXT POOLS TABLE (new)
-- ============================================
-- Text variants per country (2 per country per slide)

CREATE TABLE IF NOT EXISTS slide_text_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  persona_slide_id UUID NOT NULL REFERENCES persona_slides(id) ON DELETE CASCADE,
  country TEXT NOT NULL CHECK (country IN ('uk', 'us', 'ksa', 'my')),
  variant_index INTEGER NOT NULL CHECK (variant_index >= 1 AND variant_index <= 2),
  content TEXT NOT NULL DEFAULT '',
  layout_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(persona_slide_id, country, variant_index)
);

CREATE INDEX IF NOT EXISTS idx_slide_text_pools_slide_id ON slide_text_pools(persona_slide_id);
CREATE INDEX IF NOT EXISTS idx_slide_text_pools_country ON slide_text_pools(country);

