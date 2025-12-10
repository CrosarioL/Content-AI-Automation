# Testing Checklist

Use this to verify everything works after setup.

---

## ✅ Pre-flight Checks

Run these before testing the app:

```bash
# 1. Verify environment variables are set
cat .env.local
# Should show your Supabase URL and key

# 2. Verify all dependencies are installed
npm list @supabase/supabase-js lucide-react
# Should show version numbers, no errors

# 3. Start the dev server
npm run dev
# Should show: ready - started server on 0.0.0.0:3000
```

---

## ✅ Test 1: Basic Navigation

**Goal:** Verify the app loads and navigation works

1. Open http://localhost:3000
2. You should see the sidebar with: Ideas, Queue, Assets
3. Click each navigation item:
   - **Ideas** → Should show empty state with "New Idea" button
   - **Queue** → Should show "No render jobs yet"
   - **Assets** → Should show "Coming Soon" placeholder

**Expected:** No errors in browser console (press F12)

---

## ✅ Test 2: Create Simple Idea

**Goal:** Create an idea with minimal data

1. Click **"New Idea"**
2. Fill in:
   - **Title:** "Test Idea 1"
   - **Category:** Leave as default
   - **Personas:** Leave "Main" selected (default)
   - **Countries:** Leave "UK" selected (default)
   - **Slide 1:** "This is a test hook"
   - **Slide 2:** "This is a test problem"
3. Click **"Create Idea"**

**Expected:**
- Redirects to idea detail page
- Shows your title and category
- Shows "Main" persona and UK country
- Shows your slide content

---

## ✅ Test 3: Create Complex Idea

**Goal:** Test multiple personas and countries

1. Go back to Ideas → Click **"New Idea"**
2. Fill in:
   - **Title:** "Multi-Variant Test"
   - **Category:** "Finance"
   - **Personas:** Select all three (Main, Male, Female)
   - **Countries:** Select UK and US
3. Switch between persona tabs and fill in different text for each
4. Switch between country tabs (UK/US flags) and vary the text
5. Fill at least Slide 1 for each combination
6. Click **"Create Idea"**

**Expected:**
- Shows 3 personas (Main, Male, Female)
- Shows 2 countries (UK, US)
- Content is organized by persona → country

---

## ✅ Test 4: Generate Jobs

**Goal:** Create render jobs from an idea

1. On any idea detail page, click **"Generate Jobs (X)"**
   - Number should match: personas × countries
   - Example: 3 personas × 2 countries = 6 jobs
2. Wait for success message
3. Should redirect to Queue page

**Expected:**
- See X new jobs with status "pending"
- Each job shows correct persona and country
- Jobs show the idea title

---

## ✅ Test 5: Queue Management

**Goal:** Verify queue displays correctly

1. Go to **Queue** page
2. Verify you see all generated jobs
3. Check each column:
   - **Idea:** Should show title and category
   - **Persona:** Should show Main/Male/Female
   - **Country:** Should show flag and name
   - **Status:** Should be yellow "pending" badge
   - **Created:** Should show today's date and time

**Expected:**
- Jobs are sorted by newest first
- All data displays correctly
- No broken layouts

---

## ✅ Test 6: Database Integrity

**Goal:** Verify data is actually in Supabase

1. Go to Supabase dashboard
2. Click **Table Editor**
3. Check these tables:
   - **ideas:** Should see your created ideas
   - **persona_variants:** Should see one row per persona per idea
   - **slide_contents:** Should see 7 rows per persona-country combo
   - **render_jobs:** Should see your generated jobs

**Expected:**
- All data is present
- Foreign keys link correctly
- No null values where they shouldn't be

---

## ✅ Test 7: Error Handling

**Goal:** Make sure errors are handled gracefully

1. **Test missing required fields:**
   - Try to create idea without title → Should show validation error

2. **Test database connection:**
   - In Supabase, temporarily revoke your API key
   - Try to load Ideas page → Should show error (not blank page)
   - Restore your API key

3. **Test invalid idea ID:**
   - Go to /ideas/00000000-0000-0000-0000-000000000000
   - Should show "Idea not found" (not crash)

**Expected:**
- App handles errors without crashing
- Error messages are user-friendly

---

## ✅ Test 8: Real-World Scenario

**Goal:** Simulate actual usage

1. Create 3 different ideas:
   - One with Main persona only, UK only
   - One with Main + Male, UK + US
   - One with all personas, all countries

2. Generate jobs for all three

3. Go to Queue and verify:
   - First idea: 1 job
   - Second idea: 4 jobs (2 personas × 2 countries)
   - Third idea: 12 jobs (3 personas × 4 countries)
   - Total: 17 jobs

**Expected:**
- All 17 jobs appear in queue
- Each has correct persona/country combination
- Queue page loads fast even with many jobs

---

## ✅ Browser Console Check

Open browser DevTools (F12) → Console tab:

**Should NOT see:**
- Red error messages
- "Failed to fetch"
- "undefined is not a function"
- CORS errors

**Might see (these are OK):**
- Blue info messages from Next.js
- Router navigation logs

---

## ✅ Performance Check

**Goal:** Make sure app is responsive

1. Create 5 ideas
2. Generate jobs for all of them (50+ jobs)
3. Navigate between pages
4. Reload pages

**Expected:**
- Pages load in < 2 seconds
- No lag when typing in forms
- Smooth navigation between pages

---

## 🚨 Common Issues & Fixes

### "Failed to create idea"
```bash
# Check environment variables
cat .env.local

# Restart dev server
npm run dev
```

### "TypeError: Cannot read property 'id'"
→ Database tables might not exist
→ Re-run `database.sql` in Supabase

### Page shows blank
→ Check browser console for errors
→ Verify all files are in correct folders

### "Module not found"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## ✅ Final Checklist

Before moving to Phase 6, verify:

- [ ] Can create ideas with all persona combinations
- [ ] Can create ideas with all country combinations
- [ ] Slide content saves correctly for each variant
- [ ] Generate Jobs button creates correct number of jobs
- [ ] Queue displays all jobs with correct data
- [ ] Can navigate between all pages without errors
- [ ] No console errors in browser
- [ ] Data persists after page refresh
- [ ] Supabase shows all data correctly

---

## Next Steps

Once all tests pass:

1. **Play with the app** - create real content ideas
2. **Identify pain points** - what's slow or confusing?
3. **Ready for Phase 6** - Add Puppeteer and FFmpeg rendering

---

## Getting Help

If something doesn't work:

1. Check browser console (F12)
2. Check terminal where `npm run dev` is running
3. Check Supabase logs (Dashboard → Logs)
4. Verify database tables exist (Table Editor)
5. Confirm environment variables are set correctly
