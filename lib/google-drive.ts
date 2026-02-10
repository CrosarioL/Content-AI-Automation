import { google } from 'googleapis'
import { Readable } from 'stream'

// =============================================
// Auth helpers
// =============================================

// Service account auth (old path - requires Shared Drive)
function getServiceAccountDriveClient() {
  const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS
  if (!credentials) {
    throw new Error(
      'GOOGLE_DRIVE_CREDENTIALS environment variable is not set. Either set this for service account mode or configure OAuth env vars.'
    )
  }

  let creds
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

// OAuth2 auth using YOUR Google account (no Workspace / Shared Drive required)
function getOAuthDriveClient() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  const redirectUri =
    process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Drive OAuth env vars are not set. Please set GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET and GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN in .env.local.'
    )
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  oAuth2Client.setCredentials({ refresh_token: refreshToken })

  return google.drive({ version: 'v3', auth: oAuth2Client })
}

// Main entry: prefer OAuth (your account). Fallback to service account if configured.
export function getDriveClient() {
  // If OAuth env vars are present, use OAuth mode (uploads as your own Google account)
  if (
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN
  ) {
    return getOAuthDriveClient()
  }

  // Otherwise, fall back to legacy service account mode
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

    // NOTE: We do NOT automatically make the file public.
    // In OAuth mode, the uploading Google account already has access.
    // In service-account mode, folder sharing should grant access.

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`,
    }
  } catch (error: any) {
    console.error('[google-drive] Upload error:', error)

    // Provide more helpful error messages
    if (error.code === 403) {
      // Distinguish between quota issue and plain permission issue
      if (
        error.errors?.some(
          (e: any) =>
            e.reason === 'storageQuotaExceeded' ||
            e.message?.includes('Service Accounts do not have storage quota')
        )
      ) {
        throw new Error(
          'Google Drive storage quota error. For service accounts, you must either use a Shared Drive or switch to OAuth mode using your own Google account.'
        )
      }

      throw new Error(
        'Permission denied. Make sure the target folder exists, you shared it with the account you are authenticating as, and Google Drive API is enabled.'
      )
    } else if (error.code === 404) {
      throw new Error(
        'Folder not found. Check that the folder ID is correct and that the authenticated account can see it.'
      )
    } else if (error.message?.includes('credentials')) {
      throw new Error(
        'Invalid Google Drive credentials. For service accounts, check GOOGLE_DRIVE_CREDENTIALS. For OAuth, check GOOGLE_DRIVE_OAUTH_* env vars in .env.local.'
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
