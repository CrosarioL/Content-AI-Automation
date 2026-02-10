import { NextRequest, NextResponse } from 'next/server'
import { uploadToGoogleDrive } from '@/lib/google-drive'

export const maxDuration = 300

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50)
}

/** Accepts ZIP file from client (client-rendered slides) and uploads to Drive */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const ideaTitle = formData.get('ideaTitle') as string | null
    const folderId = formData.get('folderId') as string | null || process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!file || !folderId) {
      return NextResponse.json(
        { error: 'Missing file or folderId' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const zipBuffer = Buffer.from(arrayBuffer)

    // Use uploaded filename (e.g. TEST-2-KSA.zip) or fallback to ideaTitle-export.zip
    const fileName = file.name && file.name.endsWith('.zip')
      ? sanitizeFilename(file.name.replace(/\.zip$/, '')) + '.zip'
      : `${sanitizeFilename(ideaTitle || 'export')}-export.zip`

    const uploadResult = await uploadToGoogleDrive({
      fileBuffer: zipBuffer,
      fileName,
      folderId,
      mimeType: 'application/zip',
    })

    return NextResponse.json({
      success: true,
      fileId: uploadResult.fileId,
      webViewLink: uploadResult.webViewLink,
      message: 'Uploaded to Google Drive.',
    })
  } catch (error: any) {
    console.error('[export/drive-upload] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}
