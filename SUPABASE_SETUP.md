# Supabase Setup Guide

Quick guide to get your Supabase database configured.

---

## Step 1: Create Supabase Project

1. Go to **[supabase.com](https://supabase.com)**
2. Sign up or log in (free account works fine)
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: `content-generator` (or any name you like)
   - **Database Password**: Create a strong password ⚠️ **SAVE THIS!** You'll need it later
   - **Region**: Choose the one closest to you
5. Click **"Create new project"**
6. ⏱️ Wait 2-3 minutes for it to provision

---

## Step 2: Get Your API Credentials

Once your project is ready:

1. In Supabase dashboard, click the **Settings** icon (⚙️ gear) in the left sidebar
2. Click **"API"** in the settings menu
3. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

Keep these handy - you'll need them in Step 4.

---

## Step 3: Create Database Tables

1. In Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"** button
3. Open the `database.sql` file from this project
4. Copy the **entire contents** of `database.sql`
5. Paste it into the SQL Editor
6. Click **"Run"** (or press `Ctrl/Cmd + Enter`)
7. You should see: ✅ **"Success. No rows returned"**

This creates all the tables your app needs:
- `ideas` - Your content ideas
- `persona_variants` - Persona types (main/male/female)
- `country_variants` - Country variants (uk/us/ksa/my)
- `slide_templates` - Slide structure templates
- `slide_contents` - Actual slide text content
- `render_jobs` - Video generation jobs
- `idea_images` - Uploaded images (for Phase 5)

### 🔁 Dynamic Slide Variants (Phase 3 Upgrade)

If your database was provisioned **before** the Phase 3 upgrade, run the snippet below inside Supabase SQL Editor to add the new slide variant tables:

```sql
ALTER TABLE slide_contents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE slide_contents ADD COLUMN IF NOT EXISTS notes TEXT;

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

CREATE INDEX IF NOT EXISTS idx_slide_text_variants_slide_id ON slide_text_variants(slide_id);
CREATE INDEX IF NOT EXISTS idx_slide_image_variants_slide_id ON slide_image_variants(slide_id);
```

Optional backfill to turn existing slide text into a variant:

```sql
INSERT INTO slide_text_variants (slide_id, variant_label, content, sort_order)
SELECT id, 'Variant 1', content, 0
FROM slide_contents
WHERE id NOT IN (SELECT slide_id FROM slide_text_variants);

ALTER TABLE slide_text_variants
  ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{}'::jsonb;
```

---

## Step 4: Set Up Environment Variables

1. In your project root, create a file called `.env.local`
2. Add these two lines (replace with YOUR values from Step 2):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTIzNDU2NywiZXhwIjoxOTYwODEwNTY3fQ.abc123def456...
```

⚠️ **Important:** 
- Don't commit `.env.local` to git (it's already in `.gitignore`)
- Never share your anon key publicly
- The anon key is safe to use in client-side code (it's designed for that)

### 📦 Slide Asset Storage Bucket

Image variants are stored in Supabase Storage.

1. Go to **Storage → Buckets → Create bucket**
2. Name it `slide-assets` (or set `SLIDE_ASSETS_BUCKET` / `NEXT_PUBLIC_SLIDE_ASSETS_BUCKET` if you prefer another name)
3. Enable **Public bucket** so downstream services can fetch assets
4. The `/api/uploads` route already uses the service role key for authenticated uploads
5. (Optional) add storage policies for file size/type limits

---

## Step 5: Verify It Works

1. Make sure your `.env.local` file is saved
2. Restart your dev server if it's running:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```
3. Open your app at http://localhost:3000
4. Check the browser console (F12) - there should be no Supabase connection errors

---

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists in the project root
- Check the variable names are exactly: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Restart your dev server after creating/editing `.env.local`

### "Failed to fetch" or connection errors
- Double-check your Project URL and anon key are correct
- Make sure there are no extra spaces or quotes in `.env.local`
- Verify your Supabase project is active (green status in dashboard)

### Tables don't exist
- Go back to Supabase → SQL Editor
- Run the `database.sql` script again
- Check the "Table Editor" in Supabase to see if tables were created

### Can't find API credentials
- Go to: Supabase Dashboard → Settings (⚙️) → API
- The Project URL is at the top
- The anon key is under "Project API keys" → "anon" → "public"

---

## What's Next?

Once Supabase is set up:
- ✅ Your app can now connect to the database
- ✅ You can create ideas and store data
- ✅ Ready for Phase 1 (Data modeling) and Phase 2 (Connect Supabase)

---

## Quick Reference

**Supabase Dashboard:** https://supabase.com/dashboard

**Where to find credentials:**
- Settings → API → Project URL
- Settings → API → Project API keys → anon public

**Where to run SQL:**
- SQL Editor → New query → Paste `database.sql` → Run

