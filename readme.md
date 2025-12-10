# Content Generator V1

Internal web app for AI social media content generation. Create TikTok and Instagram content with multi-persona, multi-country variants.

---

## 📋 What This Does

- **Manage Ideas:** Create content ideas with multiple personas (Main, Male, Female)
- **Multi-Country:** Target UK, US, Saudi Arabia, and Malaysia with localized content
- **Slide Content:** 7-slide structure (Hook, Problem, Agitation, Solution, Benefit, Proof, CTA)
- **Job Generation:** Automatically create render jobs for each persona-country combination
- **Queue Management:** Track status of all render jobs

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- Supabase account (free tier works)

### 2. Set Up Supabase
1. Create project at https://supabase.com
2. Run `database.sql` in SQL Editor
3. Get API credentials from Settings → API

### 3. Install & Configure
```bash
# Create Next.js project
npx create-next-app@latest content-generator --typescript --tailwind --app --no-src-dir
cd content-generator

# Install dependencies
npm install @supabase/supabase-js lucide-react clsx tailwind-merge

# Copy all provided files into your project

# Create .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=your_url" > .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key" >> .env.local

# Run!
npm run dev
```

Open http://localhost:3000

---

## 📁 Project Structure

```
content-generator/
├── app/
│   ├── api/                    # API routes
│   │   ├── ideas/route.ts      # Create ideas
│   │   └── generate-jobs/      # Generate render jobs
│   ├── ideas/                  # Ideas management
│   │   ├── page.tsx            # List all ideas
│   │   ├── new/page.tsx        # Create new idea
│   │   └── [id]/page.tsx       # View idea details
│   ├── queue/page.tsx          # Render job queue
│   ├── assets/page.tsx         # Asset management (placeholder)
│   ├── layout.tsx              # Root layout with sidebar
│   └── page.tsx                # Home (redirects to ideas)
├── components/
│   ├── sidebar.tsx             # Main navigation
│   ├── idea-form.tsx           # Create/edit idea form
│   └── generate-jobs-button.tsx
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── db.ts                   # Database queries
│   ├── utils.ts                # Helper functions
│   └── constants.ts            # App constants
├── types/
│   └── index.ts                # TypeScript types
└── database.sql                # Database schema
```

---

## 🗄️ Database Schema

### Tables
- **ideas** - Core content ideas
- **persona_variants** - Persona types per idea
- **slide_contents** - Slide text for each persona-country combo
- **templates** - Rendering templates (default included)
- **render_jobs** - Generated video render jobs
- **idea_images** - Uploaded images (future)

### Key Relationships
```
Idea (1) → (N) PersonaVariant → (N) SlideContent
Idea (1) → (N) RenderJob
```

---

## 🎯 Usage Flow

1. **Create Idea**
   - Go to Ideas → New Idea
   - Fill in title, category
   - Select personas (Main, Male, Female)
   - Select countries (UK, US, KSA, MY)
   - Write slide content for each combination

2. **Review Idea**
   - View all variants
   - See slide content organized by persona/country

3. **Generate Jobs**
   - Click "Generate Jobs" button
   - Creates one job per persona-country combo
   - Each job will render to a single video for both TikTok & IG

4. **Monitor Queue**
   - View all render jobs
   - Track status (pending → processing → done)

---

## 🔑 Key Features

### Multi-Persona Support
Create content variations for different audience segments:
- **Main:** Gender-neutral content
- **Male:** Male-targeted messaging
- **Female:** Female-targeted messaging

### Multi-Country Localization
Adapt content for regional audiences:
- **UK** 🇬🇧 - British English, local references
- **US** 🇺🇸 - American English, US-specific content
- **KSA** 🇸🇦 - Saudi Arabia localization
- **MY** 🇲🇾 - Malaysia localization

### Efficient Job Generation
One video serves both platforms:
- Single render job per persona-country combo
- Use same video for TikTok AND Instagram
- No duplicate rendering needed

---

## 🎨 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **UI Components:** Custom + Lucide Icons
- **State:** React Server Components + Client Components

---

## 🧪 Testing

See `TESTING_CHECKLIST.md` for comprehensive testing guide.

Quick test:
```bash
# 1. Start dev server
npm run dev

# 2. Open browser
open http://localhost:3000

# 3. Create test idea
# - Title: "Test"
# - Category: Any
# - Main persona, UK country
# - Fill in at least Slide 1

# 4. Generate jobs
# Should create 1 job in queue
```

---

## 📦 What's NOT in V1

This is a foundation. NOT yet implemented:

- ❌ Actual video rendering (Puppeteer/FFmpeg)
- ❌ Image upload and management
- ❌ TikTok API posting
- ❌ Instagram API posting
- ❌ User authentication
- ❌ Template customization UI
- ❌ Job retry logic
- ❌ Batch operations

These will come in future phases.

---

## 🚧 Next Phase (Phase 6)

After V1 is stable, add:

1. **Image Upload**
   - Supabase Storage integration
   - Image assignment to slides

2. **Video Rendering**
   - Puppeteer for slide screenshots
   - FFmpeg for video compilation
   - Progress tracking

3. **API Integrations**
   - TikTok posting
   - Instagram posting
   - Caption generation

---

## 🐛 Troubleshooting

### App won't start
```bash
# Check Node version
node -v  # Should be 18+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database errors
```bash
# Verify environment variables
cat .env.local

# Re-run database schema
# Go to Supabase → SQL Editor → Run database.sql
```

### "Failed to create idea"
- Check browser console (F12)
- Verify Supabase credentials
- Check Supabase table exists

### Port already in use
```bash
npx kill-port 3000
npm run dev
```

---

## 📚 Documentation Files

- `README.md` - This file (overview)
- `SETUP_INSTRUCTIONS.md` - Detailed setup guide
- `QUICK_START.md` - 10-minute setup
- `TESTING_CHECKLIST.md` - Complete testing guide
- `database.sql` - Database schema

---

## 🤝 Contributing

This is an internal tool. To improve:

1. Test thoroughly using checklist
2. Note bugs or UX issues
3. Propose improvements
4. Keep it simple and maintainable

---

## 📝 License

Internal use only - not for public distribution.

---

## 🎉 You're Ready!

Follow `QUICK_START.md` to get running in 10 minutes.

Questions? Check `SETUP_INSTRUCTIONS.md` for detailed help.
