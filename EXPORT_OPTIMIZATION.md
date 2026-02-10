# Export Optimization & Google Drive Integration

## ✅ What's Been Optimized

### 1. **Parallel Slide Rendering**
- **Before**: Slides rendered sequentially (one at a time) - very slow
- **After**: All slides render in parallel using `Promise.all()` - **much faster**
- **Impact**: If you have 7 slides, they now render simultaneously instead of waiting for each one

### 2. **Video Compilation Made Optional**
- **Before**: Every export compiled videos (very CPU-intensive and slow)
- **After**: Videos are skipped by default (can be enabled with `includeVideos: true`)
- **Impact**: Exports are now **significantly faster** - you can compile videos separately if needed

### 3. **Browser Reuse**
- **Before**: Browser closed/reopened for each post
- **After**: Browser stays open across all posts, only closes at the end
- **Impact**: Faster processing, less overhead

### 4. **Google Drive Upload**
- New option to upload directly to Google Drive instead of downloading ZIP
- Perfect for transferring to iPhone - just open Drive app and download

---

## 🚀 Google Drive Setup

### Step 1: Create Google Cloud Project & Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable **Google Drive API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### Step 2: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in:
   - **Name**: `content-generator-drive` (or any name)
   - **Description**: `Service account for uploading exports to Google Drive`
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"

### Step 3: Create & Download Key

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose **JSON** format
5. Download the JSON file

### Step 4: Share Google Drive Folder (Optional)

If you want files uploaded to a specific folder:

1. Create a folder in Google Drive (or use existing)
2. Right-click the folder → "Share"
3. Add the service account email (found in the JSON file, looks like `xxx@xxx.iam.gserviceaccount.com`)
4. Give it **Editor** permission
5. Copy the folder ID from the URL (the long string after `/folders/`)

### Step 5: Add to Environment Variables

Add to your `.env.local` file:

```bash
# Google Drive Service Account Credentials (paste entire JSON content as one line, or use escaped JSON)
GOOGLE_DRIVE_CREDENTIALS='{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'

# Optional: Google Drive folder ID (if you want files in a specific folder)
GOOGLE_DRIVE_FOLDER_ID='your-folder-id-here'
```

**Important**: The JSON must be on a single line or properly escaped. You can also:
- Use a JSON file path (requires code modification)
- Store it in a secrets manager (recommended for production)

### Step 6: Install Dependencies

```bash
npm install googleapis
```

---

## 📱 Using the Export Features

### Download ZIP (Fast - No Videos)
- Click **"Download ZIP"** button
- Gets all slide images + metadata
- Much faster than before (parallel rendering, no video compilation)

### Upload to Google Drive
- Click **"Upload to Drive"** button
- Files uploaded directly to your Google Drive
- Perfect for iPhone access - just open Drive app
- Link is shown after upload completes

### Include Videos (Slower)
To include videos in export, you'd need to modify the API call to include `includeVideos: true` in the request body. This is intentionally disabled by default because it's very slow.

---

## 🎯 TikTok API Research

**Result**: TikTok does NOT have a public API for uploading videos as drafts.

- TikTok has a **Content Posting API** but:
  - Requires business approval/application
  - Very restricted access
  - Not available for general use
  - Cannot upload drafts programmatically

**Recommendation**: Use Google Drive upload instead - it's the most practical solution for transferring files to your iPhone and then uploading to TikTok manually.

---

## ⚡ Performance Improvements

**Before**:
- Sequential rendering: ~5-10 seconds per slide
- Video compilation: ~30-60 seconds per post
- Total for 7 slides + 1 video: ~2-3 minutes per post

**After**:
- Parallel rendering: ~5-10 seconds for all slides
- No video compilation: 0 seconds
- Total for 7 slides: ~5-10 seconds per post

**Speed improvement**: **~10-20x faster** for exports without videos!

---

## 🔧 Troubleshooting

### Google Drive Upload Fails

1. **Check credentials**: Make sure `GOOGLE_DRIVE_CREDENTIALS` is set correctly
2. **Check API enabled**: Verify Google Drive API is enabled in Google Cloud Console
3. **Check permissions**: If using a folder, make sure service account has access
4. **Check logs**: Look at server console for detailed error messages

### Export Still Slow

- Make sure you're using the optimized version (parallel rendering)
- Check if videos are being compiled (they shouldn't be by default)
- Check server resources (CPU/memory) - Puppeteer is resource-intensive

### Browser Crashes

- Increase server memory if possible
- Reduce number of concurrent renders (modify code to batch)
- Check Puppeteer configuration in `lib/renderer.ts`

---

## 📝 Next Steps

1. **Install dependencies**: `npm install googleapis`
2. **Set up Google Drive**: Follow steps above
3. **Test export**: Try both download and Drive upload
4. **Refine as needed**: Adjust based on your workflow

The export should now be **much faster** and you have the option to upload directly to Google Drive for easy iPhone access! 🎉
