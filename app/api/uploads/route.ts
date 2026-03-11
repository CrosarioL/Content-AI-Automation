import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

const DEFAULT_BUCKET = process.env.SLIDE_ASSETS_BUCKET || 'slide-assets'
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || '') || 15 * 1024 * 1024

function sanitizeFileName(name: string): string {
  const lower = (name || 'upload').trim().toLowerCase()
  const extMatch = lower.match(/^(.*?)(\.[a-z0-9]+)?$/)
  const rawBase = (extMatch?.[1] || lower).trim()
  const rawExt = (extMatch?.[2] || '').trim()

  // keep simple URL/path-safe chars; collapse runs of '-'
  const safeBase = rawBase
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  const safeExt = rawExt && /^\.[a-z0-9]+$/.test(rawExt) ? rawExt : ''
  return `${safeBase || 'upload'}${safeExt}`
}

function contentTypeFromName(name: string): string | null {
  const n = (name || '').toLowerCase()
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.webp')) return 'image/webp'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File upload is required' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large (${Math.round(file.size / 1024 / 1024)}MB). Max allowed is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`,
        },
        { status: 413 }
      )
    }

    if (file.type && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: `Unsupported file type (${file.type}). Please upload an image.` },
        { status: 415 }
      )
    }

    const ideaId = (formData.get('ideaId') as string) || 'global'
    const persona = (formData.get('persona') as string) || 'persona'
    const slideId = (formData.get('slide') as string) || 'slide'
    const slot = (formData.get('slot') as string) || 'generic'
    // For backward compatibility
    const country = (formData.get('country') as string) || ''
    const variantId = (formData.get('variant') as string) || ''

    const sanitizedName = sanitizeFileName(file.name)
    
    // v2 path structure: ideaId/persona/slide/slot-timestamp-filename
    // v1 path structure: ideaId/persona/country/slide/variant-timestamp-filename
    const objectPath = country
      ? `${ideaId}/${persona}/${country}/${slideId}/${variantId}-${Date.now()}-${sanitizedName}`
      : `${ideaId}/${persona}/${slideId}/${slot}-${Date.now()}-${sanitizedName}`

    const inferredType = contentTypeFromName(sanitizedName)
    const contentType = file.type || inferredType || 'application/octet-stream'
    const body = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await supabaseServer.storage
      .from(DEFAULT_BUCKET)
      .upload(objectPath, body, {
        contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('[UPLOAD] Storage error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload image' },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabaseServer.storage.from(DEFAULT_BUCKET).getPublicUrl(objectPath)

    return NextResponse.json(
      {
        path: objectPath,
        url: publicUrl,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[UPLOAD] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload asset' },
      { status: 500 }
    )
  }
}


