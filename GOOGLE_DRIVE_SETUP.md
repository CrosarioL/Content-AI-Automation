# Google Drive export setup

For **personal Google accounts** (Gmail), the app uses **OAuth** so that uploads are owned by you and use **your** storage quota. Service accounts have no storage quota, so uploads created by a service account fail with a quota error even when the folder is shared.

---

## Use OAuth (recommended for personal Drive)

1. **Google Cloud Console** → your project → **APIs & Services** → **Credentials**.
2. Create **OAuth 2.0 Client ID** (Desktop or Web). Note **Client ID** and **Client secret**.
3. Get a **refresh token** once (e.g. run `node get-drive-refresh-token.js` in this project, or use any OAuth playground that requests `https://www.googleapis.com/auth/drive.file`).
4. Set in `.env.local` and on **Render**:
   - `GOOGLE_DRIVE_OAUTH_CLIENT_ID`
   - `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`
   - `GOOGLE_DRIVE_FOLDER_ID` = folder ID from your Drive folder URL (`.../folders/FOLDER_ID`).

### Avoid 7-day refresh token expiry

If your OAuth app is in **Testing** mode, refresh tokens expire after 7 days. To get a long-lived token:

1. In Google Cloud Console: **APIs & Services** → **OAuth consent screen**.
2. Set **Publishing status** to **Production** (or add your Gmail as a test user and re-authorize to get a new refresh token when needed).

With **Production** status, refresh tokens don’t expire after 7 days.

---

## Service account (optional)

Service accounts don’t have their own Drive quota. They are useful for **Google Workspace** with domain-wide delegation, or for non-upload flows. For uploading to a **personal** Drive folder, the app prefers **OAuth** when the OAuth env vars are set, so uploads use your quota. You can leave `GOOGLE_DRIVE_CREDENTIALS` set as a fallback; the app will use OAuth first if those three OAuth vars are present.
