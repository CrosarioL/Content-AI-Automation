import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import { getIdeaWithDetailsV2 } from '@/lib/db'

// GET: full idea fetch (used by edit page)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const idea = await getIdeaWithDetailsV2(params.id)
    
    if (!idea) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ idea })
  } catch (error: any) {
    console.error('[ideas/v2/[id] GET] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch idea' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ideaId = params.id
    const body = await request.json()
    const { title, category, description, aspect_ratio, personas } = body

    // Update idea basic info
    const { error: updateError } = await supabaseServer
      .from('ideas')
      .update({
        title,
        category,
        description: description || null,
        aspect_ratio: aspect_ratio || '9:16',
      })
      .eq('id', ideaId)

    if (updateError) throw updateError

    // Process personas in parallel
    await Promise.all((personas || []).map(async (personaData: any) => {
      const { data: existingPV } = await supabaseServer
        .from('persona_variants')
        .select('id')
        .eq('idea_id', ideaId)
        .eq('persona_type', personaData.persona_type)
        .single()

      let personaVariantId: string

      if (existingPV) {
        personaVariantId = existingPV.id
        await supabaseServer
          .from('persona_slides')
          .delete()
          .eq('persona_variant_id', personaVariantId)
      } else {
        const { data: newPV, error: pvError } = await supabaseServer
          .from('persona_variants')
          .insert({
            idea_id: ideaId,
            persona_type: personaData.persona_type,
          })
          .select('id')
          .single()
        if (pvError) throw pvError
        personaVariantId = newPV.id
      }

      const slidesData = personaData.slides || []
      if (slidesData.length === 0) return

      const slidesToInsert = slidesData.map((s: any) => ({
        persona_variant_id: personaVariantId,
        slide_number: s.slide_number,
        slide_type: s.slide_type,
        title: s.title || null,
      }))

      const { data: insertedSlides, error: slidesError } = await supabaseServer
        .from('persona_slides')
        .insert(slidesToInsert)
        .select('id')

      if (slidesError) throw slidesError
      if (!insertedSlides || insertedSlides.length !== slidesData.length) {
        throw new Error('Slide insert failed')
      }

      // Flatten all text_pools and image_pools with correct slide IDs
      const allTextPools: any[] = []
      const allImagePools: any[] = []

      for (let i = 0; i < slidesData.length; i++) {
        const slideId = insertedSlides[i].id
        const slideData = slidesData[i]
        for (const tp of slideData.text_pools || []) {
          allTextPools.push({
            persona_slide_id: slideId,
            country: tp.country,
            variant_index: tp.variant_index,
            content: tp.content,
            layout_config: tp.layout_config || {},
          })
        }
        for (const ip of slideData.image_pools || []) {
          allImagePools.push({
            persona_slide_id: slideId,
            slot: ip.slot || 'generic',
            storage_path: ip.storage_path,
            variant_label: ip.variant_label || null,
            metadata: ip.transform ? { transform: ip.transform } : {},
          })
        }
      }

      if (allTextPools.length > 0) {
        const { error: textError } = await supabaseServer
          .from('slide_text_pools')
          .insert(allTextPools)
        if (textError) throw textError
      }
      if (allImagePools.length > 0) {
        const { error: imgError } = await supabaseServer
          .from('slide_image_pools')
          .insert(allImagePools)
        if (imgError) throw imgError
      }
    }))

    // Return success without refetching - client redirects to idea page
    return NextResponse.json({ success: true, idea: { id: ideaId } })
  } catch (error: any) {
    console.error('[ideas/v2/[id] PUT] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update idea' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabaseServer
      .from('ideas')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[ideas/v2/[id] DELETE] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete idea' },
      { status: 500 }
    )
  }
}

