# Master Setup Guide

Complete walkthrough to get your Content Generator running. Follow these steps IN ORDER.

---

## 📋 Overview

You have received **21 files** that make up your complete V1 app:

### Code Files (17)
1. `app/layout.tsx` - Root layout with sidebar
2. `app/globals.css` - Global styles
3. `app/page.tsx` - Home page redirect
4. `app/ideas/page.tsx` - Ideas list page
5. `app/ideas/new/page.tsx` - New idea page
6. `app/ideas/[id]/page.tsx` - Idea detail page
7. `app/api/ideas/route.ts` - Create idea API
8. `app/api/generate-jobs/route.ts` - Generate jobs API
9. `app/queue/page.tsx` - Render queue page
10. `app/assets/page.tsx` - Assets placeholder
11. `components/sidebar.tsx` - Navigation sidebar
12. `components/idea-form.tsx` - Idea creation form
13. `components/generate-jobs-button.tsx` - Job generator
14. `lib/supabase.ts` - Supabase client
15. `lib/db.ts` - Database queries
16. `lib/utils.ts` - Helper functions
17. `lib/constants.ts` - App constants
18. `types/index.ts` - TypeScript types

### Config Files (4)
19. `package.json` - Dependencies
20. `tsconfig.json` - TypeScript config
21. `tailwind.config.ts` - Tailwind config
22. `postcss.config.js` - PostCSS config
23. `next.config.js` - Next.js config
24. `.gitignore` - Git ignore rules

### Database & Docs (3)
25. `database.sql` - Database schema
26. `README.md` - Project overview
27. `SETUP_INSTRUCTIONS.md` - Detailed setup
28. `QUICK_START.md` - Fast setup
29. `TESTING_CHECKLIST.md` - Testing guide
30. This file - Master guide

---

## 🎯 Setup Process (Choose Your Path)

### Path A: Fast Track (10 minutes)
Perfect if you just want it running ASAP.
→ **Follow `QUICK_START.md`**

### Path B: Detailed Setup (20 minutes)
Better understanding of each step.
→ **Follow `SETUP_INSTRUCTIONS.md`**

### Path C: From Scratch in Cursor (15 minutes)
If using Cursor IDE.
→ **Follow this guide below**

---

## 🚀 Path C: Cursor Setup (Recommended)

### Step 1: Create Project Folder

```bash
# Create and enter directory
mkdir content-generator
cd content-generator
```

### Step 2: Initialize Next.js

In Cursor terminal:

```bash
# Create Next.js app
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir

# Answer prompts:
# ✔ Would you like to use ESLint? Yes
# ✔ Would you like to use Turbopack? No
# ✔ Would you like to customize the default import alias? No

# Install additional dependencies
npm install @supabase/supabase-js lucide-react clsx tailwind-merge
```

### Step 3: Create Folder Structure

```bash
# Create all folders
mkdir -p app/api/ideas app/api/generate-jobs app/ideas/new app/ideas/\[id\] app/queue app/assets
mkdir -p components lib types
```

### Step 4: Copy All Files

**In Cursor:**

1. **Delete these existing files** (Next.js defaults):
   - `app/page.tsx`
   - `app/layout.tsx`
   - `app/globals.css`

2. **Create and paste each file** I provided:
   - Right-click folder → New File
   - Copy-paste content from artifacts
   - Save each file

**File-by-file checklist:**

```
✅ app/layout.tsx
✅ app/globals.css
✅ app/page.tsx
✅ app/ideas/page.tsx
✅ app/ideas/new/page.tsx
✅ app/ideas/[id]/page.tsx
✅ app/api/ideas/route.ts
✅ app/api/generate-jobs/route.ts
✅ app/queue/page.tsx
✅ app/assets/page.tsx
✅ components/sidebar.tsx
✅ components/idea-form.tsx
✅ components/generate-jobs-button.tsx
✅ lib/supabase.ts
✅ lib/db.ts
✅ lib/utils.ts
✅ lib/constants.ts
✅ types/index.ts
✅ package.json (merge with existing)
✅ tsconfig.json (replace existing)
✅ tailwind.config.ts (replace existing)
✅ postcss.config.js (should exist)
✅ next.config.js (replace if exists)
✅ .gitignore (merge with existing)
```

### Step 5: Set Up Supabase

1. **Go to** https://supabase.com
2. **Sign up/Login**
3. **Create New Project:**
   - Name: `content-generator`
   - Password: Create strong password (SAVE THIS!)
   - Region: Choose nearest
   - Click "Create new project"
   - ⏱️ Wait 2-3 minutes for provisioning

4. **Get Credentials:**
   - Click Settings (gear icon)
   - Click "API"
   - Copy:
     - **Project URL** (https://xxxxx.supabase.co)
     - **anon public key** (long string starting with eyJ...)

5. **Run Database Schema:**
   - Click "SQL Editor" in sidebar
   - Click "New query"
   - Paste entire `database.sql` content
   - Click "Run" (or Ctrl/Cmd + Enter)
   - Should see: "Success. No rows returned"

### Step 6: Configure Environment

**In Cursor**, create `.env.local` in project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**IMPORTANT:** Replace with YOUR actual values!

### Step 7: Start the App

In Cursor terminal:

```bash
# Start dev server
npm run dev
```

Should see:
```
▲ Next.js 14.2.0
- Local:        http://localhost:3000
✓ Ready in 2.1s
```

### Step 8: Open Browser

Navigate to: **http://localhost:3000**

You should see:
- Sidebar with "Content Generator" title
- Three nav items: Ideas, Queue, Assets
- Empty ideas list with "New Idea" button

---

## ✅ Verification Checklist

Run through these to confirm everything works:

### Visual Checks
- [ ] App loads without errors
- [ ] Sidebar shows on the left
- [ ] Can navigate between Ideas, Queue, Assets
- [ ] "New Idea" button is visible

### Browser Console (F12)
- [ ] No red errors
- [ ] No "Failed to fetch" messages
- [ ] No CORS errors

### Create Test Idea
- [ ] Click "New Idea"
- [ ] Fill in title: "Test Idea"
- [ ] Select Main persona (default)
- [ ] Select UK country (default)
- [ ] Fill in Slide 1: "Test hook"
- [ ] Click "Create Idea"
- [ ] Redirects to idea detail page
- [ ] Shows your title and content

### Generate Jobs
- [ ] On idea page, click "Generate Jobs (1)"
- [ ] Shows success message
- [ ] Redirects to Queue page
- [ ] See 1 pending job

### Database Check
- [ ] Go to Supabase → Table Editor
- [ ] `ideas` table has 1 row
- [ ] `persona_variants` table has 1 row
- [ ] `slide_contents` table has 7 rows
- [ ] `render_jobs` table has 1 row

---

## 🎉 Success!

If all checks pass, you have a working V1 app!

---

## 🧪 Next: Run Full Tests

Now run through `TESTING_CHECKLIST.md` for comprehensive testing:

```bash
# In Cursor, open TESTING_CHECKLIST.md
# Follow each test scenario
# Verify all pass before moving forward
```

---

## 🚨 Troubleshooting

### Common Issue #1: "Module not found"

**Symptom:** Import errors in terminal

**Fix:**
```bash
# Check all files are in correct folders
ls -R

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Restart dev server
npm run dev
```

### Common Issue #2: "Failed to create idea"

**Symptom:** Error when clicking "Create Idea"

**Fix:**
```bash
# 1. Check environment variables
cat .env.local
# Should show your Supabase URL and key

# 2. Check Supabase is running
# Go to supabase.com → your project → should be green

# 3. Re-run database schema
# Supabase → SQL Editor → Run database.sql again

# 4. Restart dev server
# Ctrl+C in terminal, then: npm run dev
```

### Common Issue #3: Blank page

**Symptom:** Page loads but shows nothing

**Fix:**
```bash
# 1. Open browser console (F12)
# Look for red errors

# 2. Check this file exists: app/layout.tsx
# If missing, recreate it from artifacts

# 3. Verify imports in layout.tsx
# Should import from './globals.css' and '@/components/sidebar'

# 4. Clear Next.js cache
rm -rf .next
npm run dev
```

### Common Issue #4: Supabase connection error

**Symptom:** "Invalid API key" or connection refused

**Fix:**
```bash
# 1. Verify credentials are correct
cat .env.local

# 2. Regenerate anon key in Supabase
# Settings → API → Reveal anon key → Copy again

# 3. Update .env.local with new key

# 4. Restart dev server
```

### Common Issue #5: TypeScript errors

**Symptom:** Red squiggly lines in Cursor

**Fix:**
```bash
# 1. Check tsconfig.json has correct paths
cat tsconfig.json

# 2. Restart TypeScript server in Cursor
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# 3. If still errors, check imports:
# Should use @/ for root imports
# Example: import { Sidebar } from '@/components/sidebar'
```

---

## 📞 Getting Unstuck

If you're still stuck:

1. **Check all files exist:**
   ```bash
   # Should show all 18 code files
   find . -name "*.tsx" -o -name "*.ts" | grep -v node_modules
   ```

2. **Compare against file list** at top of this doc

3. **Check logs:**
   - Terminal where `npm run dev` runs
   - Browser console (F12)
   - Supabase logs (Dashboard → Logs)

4. **Start fresh:**
   ```bash
   # Delete everything and start over
   cd ..
   rm -rf content-generator
   # Follow Path C again
   ```

---

## 🎓 Understanding the Stack

Quick primer on what you're using:

- **Next.js:** React framework for web apps
- **TypeScript:** JavaScript with type safety
- **Tailwind CSS:** Utility-first CSS framework
- **Supabase:** Backend-as-a-service (PostgreSQL + APIs)
- **Lucide:** Icon library

---

## 📚 What to Read Next

After setup succeeds:

1. **README.md** - Understand project architecture
2. **TESTING_CHECKLIST.md** - Run all tests
3. **app/ideas/page.tsx** - See how pages work
4. **lib/db.ts** - See how data is fetched

---

## 🚀 You're Ready!

Once everything works:
- Play with the app
- Create multiple ideas
- Generate jobs
- Prepare for Phase 6 (rendering)

**Welcome to your Content Generator! 🎉**
