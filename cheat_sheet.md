# Cheat Sheet - Quick Reference

Fast commands and reminders for your Content Generator app.

---

## 🚀 Common Commands

```bash
# Start dev server
npm run dev

# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start

# Kill port 3000
npx kill-port 3000

# Clear Next.js cache
rm -rf .next

# Reinstall everything
rm -rf node_modules package-lock.json && npm install

# Check what's running
lsof -i :3000
```

---

## 📁 File Locations Quick Reference

```
├── app/
│   ├── ideas/page.tsx           → Ideas list
│   ├── ideas/new/page.tsx       → Create idea form
│   ├── ideas/[id]/page.tsx      → Idea detail
│   ├── queue/page.tsx           → Job queue
│   ├── api/ideas/route.ts       → POST create idea
│   └── api/generate-jobs/route.ts → POST generate jobs
├── components/
│   ├── sidebar.tsx              → Navigation
│   ├── idea-form.tsx            → New idea form
│   └── generate-jobs-button.tsx → Job generator
├── lib/
│   ├── db.ts                    → All DB queries
│   ├── supabase.ts              → Supabase client
│   ├── constants.ts             → PERSONAS, COUNTRIES
│   └── utils.ts                 → Helper functions
├── types/index.ts               → All TypeScript types
└── .env.local                   → Supabase credentials
```

---

## 🔑 Environment Variables

**.env.local** (create this file):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**To get these:**
Supabase Dashboard → Settings → API

---

## 🗄️ Database Tables

```sql
ideas               → Core content ideas
persona_variants    → Persona types per idea
slide_contents      → Slide text (7 per persona-country)
templates          → Rendering templates
render_jobs        → Generated jobs (persona × country)
idea_images        → Uploaded images (future)
```

**Quick inspect in Supabase:**
Dashboard → Table Editor → Select table

---

## 🎨 Key Constants

### Personas
```typescript
'main'   → Main (gender-neutral)
'male'   → Male-targeted
'female' → Female-targeted
```

### Countries
```typescript
'uk'  → 🇬🇧 United Kingdom
'us'  → 🇺🇸 United States
'ksa' → 🇸🇦 Saudi Arabia
'my'  → 🇲🇾 Malaysia
```

### Job Statuses
```typescript
'pending'    → Queued, not started
'processing' → Currently rendering
'done'       → Completed successfully
'error'      → Failed
```

### Slide Types
```typescript
1: 'hook'       → Attention grabber
2: 'problem'    → Pain point
3: 'agitation'  → Make it worse
4: 'solution'   → Your answer
5: 'benefit'    → What they get
6: 'proof'      → Social proof
7: 'cta'        → Call to action
```

---

## 🔧 Common Fixes

### Clear everything and restart
```bash
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

### Reset Supabase tables
```sql
-- In Supabase SQL Editor
DELETE FROM render_jobs;
DELETE FROM slide_contents;
DELETE FROM persona_variants;
DELETE FROM ideas;
```

### Check environment
```bash
# Verify env vars are set
cat .env.local

# Restart dev server (env changes need restart)
# Ctrl+C then npm run dev
```

### Browser issues
```javascript
// Open console (F12)
// Clear cache: Cmd/Ctrl + Shift + Delete
// Hard reload: Cmd/Ctrl + Shift + R
```

---

## 📊 Quick Data Checks

### Count records
```sql
-- In Supabase SQL Editor
SELECT 
  (SELECT COUNT(*) FROM ideas) as ideas,
  (SELECT COUNT(*) FROM persona_variants) as personas,
  (SELECT COUNT(*) FROM slide_contents) as slides,
  (SELECT COUNT(*) FROM render_jobs) as jobs;
```

### View latest idea
```sql
SELECT * FROM ideas ORDER BY created_at DESC LIMIT 1;
```

### View all jobs for an idea
```sql
SELECT * FROM render_jobs WHERE idea_id = 'your-id-here';
```

---

## 🧪 Testing Quick Checks

```bash
✅ App loads at localhost:3000
✅ No red errors in browser console (F12)
✅ Can create idea with Main/UK
✅ Idea appears in list
✅ Can generate 1 job
✅ Job appears in queue with "pending" status
```

---

## 📝 Job Count Calculator

```
Jobs = Personas × Countries

Examples:
- 1 persona × 1 country = 1 job
- 3 personas × 2 countries = 6 jobs
- 3 personas × 4 countries = 12 jobs
```

---

## 🌐 URLs

```
http://localhost:3000           → Home (redirects to /ideas)
http://localhost:3000/ideas     → Ideas list
http://localhost:3000/ideas/new → Create idea
http://localhost:3000/queue     → Job queue
http://localhost:3000/assets    → Assets (placeholder)
```

---

## 🔍 Debugging Checklist

When something breaks:

1. **Check browser console** (F12 → Console tab)
   - Look for red errors
   
2. **Check terminal** (where npm run dev runs)
   - Look for compilation errors
   
3. **Check Supabase**
   - Dashboard → Logs
   - Table Editor → Check data exists
   
4. **Check environment**
   - `cat .env.local`
   - Verify URLs and keys are correct
   
5. **Restart everything**
   ```bash
   # Kill dev server (Ctrl+C)
   rm -rf .next
   npm run dev
   ```

---

## 🎯 Keyboard Shortcuts (Cursor)

```
Cmd/Ctrl + P          → Quick file search
Cmd/Ctrl + Shift + P  → Command palette
Cmd/Ctrl + B          → Toggle sidebar
Cmd/Ctrl + J          → Toggle terminal
Cmd/Ctrl + `          → Toggle terminal
F12                   → Browser dev tools
Cmd/Ctrl + Shift + R  → Hard reload browser
```

---

## 📦 Dependencies

```json
{
  "@supabase/supabase-js": "Database client",
  "lucide-react": "Icons",
  "clsx": "Class name utility",
  "tailwind-merge": "Merge Tailwind classes",
  "next": "React framework",
  "react": "UI library",
  "typescript": "Type safety"
}
```

---

## 🚨 Emergency Reset

If everything is broken:

```bash
# 1. Delete project
cd ..
rm -rf content-generator

# 2. Recreate from scratch
npx create-next-app@latest content-generator --typescript --tailwind --app --no-src-dir
cd content-generator

# 3. Reinstall dependencies
npm install @supabase/supabase-js lucide-react clsx tailwind-merge

# 4. Copy all files again from artifacts

# 5. Recreate .env.local

# 6. Run
npm run dev
```

---

## 🎓 Learning Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Supabase Docs:** https://supabase.com/docs
- **Tailwind Docs:** https://tailwindcss.com/docs
- **TypeScript Docs:** https://www.typescriptlang.org/docs

---

## 💡 Pro Tips

1. **Keep terminal open** - See errors in real-time
2. **Use browser console** - Better error messages than UI
3. **Test in Supabase first** - Write SQL queries before code
4. **One change at a time** - Easier to debug
5. **Commit often** - Use git to save working states

---

## 📞 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Port in use | `npx kill-port 3000` |
| Module not found | `npm install` |
| Env not working | Restart dev server |
| Page blank | Check browser console |
| DB error | Re-run database.sql |
| TypeScript error | Restart TS server in IDE |
| Build error | Delete .next folder |

---

## 🎉 Success Indicators

You're good when:
- ✅ `npm run dev` starts without errors
- ✅ localhost:3000 shows sidebar
- ✅ No red in browser console
- ✅ Can create and view ideas
- ✅ Jobs appear in queue
- ✅ Data shows in Supabase

---

Keep this file open while developing for quick reference!
