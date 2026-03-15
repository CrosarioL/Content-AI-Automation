# Google Drive export – one-time setup (no refresh tokens)

Use a **Service Account** so the app can upload to your Google Drive **without ever expiring**. No refresh tokens, no 7-day re-auth.

---

## 1. Create a Google Cloud project (if you don’t have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project or select an existing one.

---

## 2. Enable the Drive API

1. In the console: **APIs & Services** → **Library**.
2. Search for **Google Drive API** and open it.
3. Click **Enable**.

---

## 3. Create a Service Account

1. **APIs & Services** → **Credentials** → **Create credentials** → **Service account**.
2. Name it (e.g. `content-generator-drive`) → **Create and continue** → **Done**.
3. Open the new service account → **Keys** tab → **Add key** → **Create new key** → **JSON** → **Create**.  
   A JSON file downloads (keep it private).

---

## 4. Share your Drive folder with the service account

1. Open the JSON file. Find **`client_email`** (e.g. `something@project-id.iam.gserviceaccount.com`).
2. In Google Drive, open (or create) the folder where exports should go.
3. **Right‑click the folder** → **Share**.
4. Paste the **`client_email`** as a collaborator and give it **Editor** (or at least “can add files”).
5. Copy the **folder ID** from the folder URL:  
   `https://drive.google.com/drive/folders/**FOLDER_ID**`

---

## 5. Set environment variables

**Local (`.env.local`):**

- `GOOGLE_DRIVE_CREDENTIALS` = full contents of the JSON file (one line, no line breaks), or the path to the file if your app supports that.
- `GOOGLE_DRIVE_FOLDER_ID` = the folder ID from step 4.

**Render (or other host):**

- Add **GOOGLE_DRIVE_CREDENTIALS** as a secret: paste the **entire** JSON in one line (you can minify it).
- Add **GOOGLE_DRIVE_FOLDER_ID** with the same folder ID.
- **Remove** (or leave unset) the OAuth vars so the app uses the service account:
  - `GOOGLE_DRIVE_OAUTH_CLIENT_ID`
  - `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`

The app **prefers the service account** when `GOOGLE_DRIVE_CREDENTIALS` is set, so you don’t need to refresh tokens again.

---

## Quick checklist

- [ ] Drive API enabled in Google Cloud.
- [ ] Service account created and JSON key downloaded.
- [ ] Drive folder shared with the service account **client_email** (Editor).
- [ ] `GOOGLE_DRIVE_CREDENTIALS` set (full JSON).
- [ ] `GOOGLE_DRIVE_FOLDER_ID` set to that folder’s ID.
- [ ] OAuth env vars removed or unset on the server so only the service account is used.

After this, “Generate & Export to Drive” should work without any token refresh.
