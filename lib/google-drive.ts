import { google } from 'googleapis'
import { Readable } from 'stream'

// =============================================
// Auth helpers
// =============================================
//
// Prefer SERVICE ACCOUNT: set GOOGLE_DRIVE_CREDENTIALS (JSON). No refresh tokens,
// no expiry. Share your Drive folder with the service account's client_email.
//
// OAuth is fallback: requires refresh token; in Google "Testing" mode refresh
// tokens expire in 7 days. Use service account to avoid that.

function getServiceAccountDriveClient() {
  const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS
  if (!credentials) {
    throw new Error(
      'GOOGLE_DRIVE_CREDENTIALS is not set. Use a service account for permanent access (no refresh tokens). See GOOGLE_DRIVE_SETUP.md.'
    )
  }

  let creds: any
  try {
    creds = typeof credentials === 'string' ? JSON.parse(credentials) : credentials
  } catch (e) {
    throw new Error('GOOGLE_DRIVE_CREDENTIALS must be valid JSON')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })

  return google.drive({ version: 'v3', auth })
}

function getOAuthDriveClient() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  const redirectUri =
    process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Drive OAuth env vars are not set. For no-refresh setup use a service account (GOOGLE_DRIVE_CREDENTIALS). See GOOGLE_DRIVE_SETUP.md.'
    )
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  oAuth2Client.setCredentials({ refresh_token: refreshToken })

  return google.drive({ version: 'v3', auth: oAuth2Client })
}

// Prefer OAuth when set: uploads are owned by you and use your quota.
// Service accounts have no storage quota, so uploads to your folder fail with quota error.
// Use OAuth for Drive uploads; publish the OAuth app to Production so refresh tokens don't expire in 7 days.
export function getDriveClient() {
  if (
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN
  ) {
    return getOAuthDriveClient()
  }
  return getServiceAccountDriveClient()
}

export interface UploadToDriveOptions {
  fileBuffer: Buffer
  fileName: string
  folderId?: string
  mimeType?: string
}

export async function uploadToGoogleDrive(
  options: UploadToDriveOptions
): Promise<{ fileId: string; webViewLink: string }> {
  const { fileBuffer, fileName, folderId, mimeType = 'application/zip' } = options

  try {
    console.log('[google-drive] Getting Drive client...')
    const drive = getDriveClient()

    const fileMetadata: any = {
      name: fileName,
    }

    if (folderId) {
      fileMetadata.parents = [folderId]
      console.log('[google-drive] Uploading to folder:', folderId)
    } else {
      console.log('[google-drive] Uploading to root (no folder specified)')
    }

    const media = {
      mimeType,
      body: Readable.from(fileBuffer),
    }

    console.log('[google-drive] Creating file...')
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, webViewLink, webContentLink',
    })

    if (!response.data.id) {
      throw new Error('Google Drive API did not return a file ID')
    }

    console.log('[google-drive] File created:', response.data.id)

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
    }
  } catch (error: any) {
    console.error('[google-drive] Upload error:', error)

    const msg = error?.message ?? ''
    const invalidGrant = msg.includes('invalid_grant') || error?.response?.data?.error === 'invalid_grant'

    if (invalidGrant) {
      throw new Error(
        'Google OAuth refresh token expired or invalid. Use a Service Account instead (no refresh needed): set GOOGLE_DRIVE_CREDENTIALS and share your Drive folder with the service account email. See GOOGLE_DRIVE_SETUP.md.'
      )
    }
    if (error.code === 403) {
      if (
        error.errors?.some(
          (e: any) =>
            e.reason === 'storageQuotaExceeded' ||
            e.message?.includes('Service Accounts do not have storage quota')
        )
      ) {
        throw new Error(
          'Google Drive storage quota error. Share a folder in your personal Drive with the service account email so it uploads into your quota.'
        )
      }
      throw new Error(
        'Permission denied. Share the target folder with the service account email (in GOOGLE_DRIVE_CREDENTIALS as client_email), or check that Google Drive API is enabled.'
      )
    }
    if (error.code === 404) {
      throw new Error(
        'Folder not found. Check GOOGLE_DRIVE_FOLDER_ID and that the folder is shared with the service account email (client_email in credentials).'
      )
    }
    if (msg.includes('credentials') || msg.includes('Credential')) {
      throw new Error(
        'Invalid Google Drive credentials. Use GOOGLE_DRIVE_CREDENTIALS (service account JSON). See GOOGLE_DRIVE_SETUP.md.'
      )
    }

    throw error
  }
}

// =============================================
// Folder helpers (Drive "folders" are files)
// =============================================

export async function findOrCreateDriveFolder(options: {
  name: string
  parentFolderId?: string
}): Promise<{ folderId: string; webViewLink: string }> {
  const { name, parentFolderId } = options
  const drive = getDriveClient()

  const qParts = [
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
    `name='${name.replace(/'/g, "\\'")}'`,
  ]
  if (parentFolderId) qParts.push(`'${parentFolderId}' in parents`)
  const q = qParts.join(' and ')

  const existing = await drive.files.list({
    q,
    fields: 'files(id, webViewLink, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  const found = existing.data.files?.[0]
  if (found?.id) {
    return {
      folderId: found.id,
      webViewLink:
        found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`,
    }
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })

  if (!created.data.id) {
    throw new Error('Google Drive API did not return a folder ID')
  }

  return {
    folderId: created.data.id,
    webViewLink:
      created.data.webViewLink ||
      `https://drive.google.com/drive/folders/${created.data.id}`,
  }
}
