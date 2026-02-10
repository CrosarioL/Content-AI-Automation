import { NextRequest, NextResponse } from 'next/server'
import { getIdeaWithDetailsV2, getPostInstances } from '@/lib/db'
import { buildLayoutForSlide, getEffectiveSlideChoices } from '@/lib/export-build-layouts'
import type { ExportPreparePayload, ExportPostItem, ExportSlideItem } from '@/lib/export-build-layouts'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ideaId = params.id

  try {
    const body = await request.json().catch(() => ({}))
    const folderId = (body.folderId as string | undefined) || process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!folderId) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_FOLDER_ID not set' },
        { status: 400 }
      )
    }

    const idea = await getIdeaWithDetailsV2(ideaId)
    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
    }

    const posts = await getPostInstances({ ideaId })
    if (posts.length === 0) {
      return NextResponse.json({ error: 'No posts found. Generate posts first.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const bucket = process.env.SLIDE_ASSETS_BUCKET || process.env.NEXT_PUBLIC_SLIDE_ASSETS_BUCKET || 'slide-assets'

    const getImageUrl = (img: any) => {
      if (img.metadata?.publicUrl) return img.metadata.publicUrl
      if (img.storage_path) return `${supabaseUrl}/storage/v1/object/public/${bucket}/${img.storage_path}`
      return undefined
    }

    const payload: ExportPreparePayload = {
      ideaTitle: idea.title,
      folderId,
      posts: [],
    }

    for (const post of posts) {
      const persona = idea.personas.find((p) => p.persona_type === post.persona_type)
      if (!persona) continue

      const slideChoices = getEffectiveSlideChoices(persona.slides, post.choices?.slides, post.country)
      const slides: ExportSlideItem[] = []
      for (const slideChoice of slideChoices) {
        const slide = persona.slides.find((s) => s.slide_number === slideChoice.slide_number)
        if (!slide) continue

        const layoutConfig = buildLayoutForSlide(slide, slideChoice, post.country, getImageUrl)
        if (layoutConfig) {
          slides.push({ slideNumber: slide.slide_number, layoutConfig })
        }
      }

      payload.posts.push({
        postId: post.id,
        country: post.country,
        postIndex: post.post_index,
        personaType: post.persona_type,
        slides,
      } as ExportPostItem)
    }

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error('[export/prepare] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Prepare failed' },
      { status: 500 }
    )
  }
}
