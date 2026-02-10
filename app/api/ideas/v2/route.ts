import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'
import type { Persona, Country, SlideLayoutConfig, ImageSlot } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, category, description, aspect_ratio, personas } = body

    if (!title || !category) {
      return NextResponse.json(
        { error: 'Title and category are required' },
        { status: 400 }
      )
    }

    // Create idea
    const { data: idea, error: ideaError } = await supabaseServer
      .from('ideas')
      .insert({ 
        title, 
        category, 
        description: description || null,
        aspect_ratio: aspect_ratio || '9:16',
      })
      .select('*')
      .single()

    if (ideaError) throw ideaError

    // Create personas and their slides
    for (const personaData of personas || []) {
      // Create persona variant
      const { data: personaVariant, error: pvError } = await supabaseServer
        .from('persona_variants')
        .insert({
          idea_id: idea.id,
          persona_type: personaData.persona_type,
        })
        .select('*')
        .single()

      if (pvError) throw pvError

      // Create slides
      for (const slideData of personaData.slides || []) {
        // Create persona slide
        const { data: slide, error: slideError } = await supabaseServer
          .from('persona_slides')
          .insert({
            persona_variant_id: personaVariant.id,
            slide_number: slideData.slide_number,
            slide_type: slideData.slide_type,
            title: slideData.title || null,
          })
          .select('*')
          .single()

        if (slideError) throw slideError

        // Create text pools
        for (const textPool of slideData.text_pools || []) {
          const { error: textError } = await supabaseServer
            .from('slide_text_pools')
            .insert({
              persona_slide_id: slide.id,
              country: textPool.country,
              variant_index: textPool.variant_index,
              content: textPool.content,
              layout_config: textPool.layout_config || {},
            })

          if (textError) throw textError
        }

        // Create image pools
        for (const imagePool of slideData.image_pools || []) {
          const { error: imgError } = await supabaseServer
            .from('slide_image_pools')
            .insert({
              persona_slide_id: slide.id,
              slot: imagePool.slot || 'generic',
              storage_path: imagePool.storage_path,
              variant_label: imagePool.variant_label || null,
            })

          if (imgError) throw imgError
        }
      }
    }

    return NextResponse.json({ success: true, idea })
  } catch (error: any) {
    console.error('[ideas/v2 POST] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create idea' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get all ideas (same as v1)
    const { data: ideas, error } = await supabaseServer
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ ideas })
  } catch (error: any) {
    console.error('[ideas/v2 GET] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ideas' },
      { status: 500 }
    )
  }
}

