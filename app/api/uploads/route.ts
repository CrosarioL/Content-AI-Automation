import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

const DEFAULT_BUCKET = process.env.SLIDE_ASSETS_BUCKET || 'slide-assets'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File upload is required' }, { status: 400 })
    }

    const ideaId = (formData.get('ideaId') as string) || 'global'
    const persona = (formData.get('persona') as string) || 'persona'
    const country = (formData.get('country') as string) || 'country'
    const slideId = (formData.get('slide') as string) || 'slide'
    const variantId = (formData.get('variant') as string) || 'variant'

    const sanitizedName = file.name.replace(/\s+/g, '-').toLowerCase()
    const objectPath = `${ideaId}/${persona}/${country}/${slideId}/${variantId}-${Date.now()}-${sanitizedName}`

    const { error: uploadError } = await supabaseServer.storage
      .from(DEFAULT_BUCKET)
      .upload(objectPath, file, {
        contentType: file.type || 'application/octet-stream',
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


