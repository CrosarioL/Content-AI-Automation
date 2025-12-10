# Setup Instructions

Follow these steps to get your Content Generator app running.

---

## 1. Prerequisites

Make sure you have installed:
- **Node.js** (v18 or higher)
- **npm** or **yarn**

---

## 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up for a free account (if you don't have one)
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: `content-generator` (or any name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to you
5. Click **Create new project** (takes ~2 minutes to provision)

---

## 3. Get Supabase Credentials

Once your project is ready:

1. Click on the **"Settings"** icon (gear) in the left sidebar
2. Go to **"API"** section
3. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

---

## 4. Create Database Tables

1. In Supabase, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy and paste the entire SQL from `database.sql` (see below)
4. Click **"Run"** or press `Ctrl/Cmd + Enter`
5. You should see "Success. No rows returned"

---

## 5. Set Up the Next.js Project

### Option A: If starting fresh

```bash
# Create Next.js app
npx create-next-app@latest content-generator --typescript --tailwind --app --no-src-dir
cd content-generator

# Install dependencies
npm install @supabase/supabase-js
npm install lucide-react clsx tailwind-merge

# Install shadcn/ui (optional but recommended)
npx shadcn-ui@latest init
# Choose defaults or:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
```

### Option B: If using the files I provided

1. **Copy all the files** I provided into your project:
   - Create folders as needed: `app/`, `components/`, `lib/`, `types/`
   - Place each file in its correct location

2. **Install dependencies:**
```bash
npm install @supabase/supabase-js lucide-react clsx tailwind-merge
```

---

## 6. Configure Environment Variables

1. Create a `.env.local` file in your project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

2. Replace with YOUR actual values from Step 3

**Important:** Never commit `.env.local` to git! Add it to `.gitignore`

---

## 7. Configure Tailwind (if needed)

If you're using the files I provided, make sure your `tailwind.config.ts` includes:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
```

---

## 8. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You should see the Content Generator app with a sidebar!

---

## 9. Testing the App

### Test Flow:

1. **Create an Idea**
   - Click **"New Idea"** on the Ideas page
   - Fill in:
     - Title: "Morning Routine Tips"
     - Category: "Lifestyle"
     - Select personas: Main, Male, Female
     - Select countries: UK, US
     - Fill in slide content for each persona/country combo
   - Click **"Create Idea"**

2. **View the Idea**
   - You should be redirected to the idea detail page
   - Verify all your slide content is displayed correctly

3. **Generate Render Jobs**
   - Click the **"Generate Jobs"** button on the idea detail page
   - It should show "Generate Jobs (6)" (3 personas × 2 countries)
   - After clicking, you'll be redirected to the Queue page

4. **Check the Queue**
   - Go to **Queue** in the sidebar
   - You should see 6 jobs with status "pending"
   - Each job shows: idea title, persona, country, status, created date

5. **Assets Page**
   - Click **Assets** in the sidebar
   - You'll see a placeholder (this is expected for V1)

---

## Troubleshooting

### "Failed to create idea"
- Check your browser console (F12) for errors
- Verify Supabase credentials in `.env.local`
- Make sure you ran the SQL schema

### "Supabase client not configured"
- Double-check environment variables
- Restart your dev server (`npm run dev`)

### Tables don't exist
- Go back to Supabase SQL Editor
- Run the `database.sql` script again

### Port already in use
```bash
# Kill the process on port 3000
npx kill-port 3000
# Then run dev again
npm run dev
```

---

## Next Steps

Once everything works:
- Create multiple ideas
- Test different persona/country combinations
- Explore the queue management

**Phase 6 (later):** You'll add:
- Puppeteer for slide rendering
- FFmpeg for video generation
- Supabase Storage for video files
- TikTok/IG API integration

---

## File Structure Overview

```
content-generator/
├── app/
│   ├── api/
│   │   ├── ideas/route.ts
│   │   └── generate-jobs/route.ts
│   ├── ideas/
│   │   ├── [id]/page.tsx
│   │   ├── new/page.tsx
│   │   └── page.tsx
│   ├── queue/page.tsx
│   ├── assets/page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   └── page.tsx
├── components/
│   ├── sidebar.tsx
│   ├── idea-form.tsx
│   └── generate-jobs-button.tsx
├── lib/
│   ├── supabase.ts
│   ├── db.ts
│   ├── utils.ts
│   └── constants.ts
├── types/
│   └── index.ts
├── .env.local (you create this)
└── database.sql
```

---

## Need Help?

- Check Supabase docs: https://supabase.com/docs
- Next.js docs: https://nextjs.org/docs
- Open your browser console (F12) to see detailed errors
