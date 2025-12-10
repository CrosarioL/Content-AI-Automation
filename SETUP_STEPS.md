# Quick Setup Steps

Follow these steps in order:

## Step 1: Create .env.local file

1. Copy the file `.env.example` 
2. Rename it to `.env.local` (remove `.example`)
3. The file already has your credentials filled in!

**OR** manually create `.env.local` with this content:

```
NEXT_PUBLIC_SUPABASE_URL=https://iqozbnkdexmjyuymmmln.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxb3pibmtkZXhtanl1eW1tbWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjkyOTgsImV4cCI6MjA3ODkwNTI5OH0.1dlt6GfH-_kBqJDugwJyVjIgxhQmp18-2mOpvDX0Cu8
```

## Step 2: Run Database SQL in Supabase

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **"New query"**
3. Open the file `database_clean.sql` from this project
4. **Copy ALL the SQL code** (everything from line 1 to the end)
5. **Paste it into the Supabase SQL Editor**
6. Click **"Run"** (or press `Ctrl+J`)
7. You should see: ✅ **"Success. No rows returned"**

⚠️ **IMPORTANT:** Make sure you're copying from `database_clean.sql` (the SQL file), NOT from `readme.md` or any markdown file!

## Step 3: Verify Tables Were Created

1. In Supabase, go to **"Table Editor"** in the left sidebar
2. You should see these tables:
   - `ideas`
   - `slide_templates`
   - `persona_variants`
   - `country_variants`
   - `slide_contents`
   - `render_jobs`
   - `idea_images`

## Step 4: Restart Your Dev Server

```bash
# Stop current server (Ctrl+C), then:
npm run dev
```

## Step 5: Test the App

1. Open http://localhost:3000
2. Check browser console (F12) - should be no errors
3. You should see the sidebar with Ideas, Queue, Assets

---

## ✅ Done!

Your Supabase is now connected and ready to use!

