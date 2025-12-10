import { NextRequest, NextResponse } from 'next/server'
import { getIdeaWithDetails, updateIdea, deleteIdea } from '@/lib/db'
import { supabaseServer } from '@/lib/supabase'

const DEFAULT_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ideaWithDetails = await getIdeaWithDetails(params.id)
    return NextResponse.json({ ideaWithDetails }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching idea:', error)
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
    const body = await request.json()
    const processedPersonaIds = new Map<string, string>()
    
    console.log('[PUT /api/ideas/[id]] Starting update for idea:', params.id)
    console.log('[PUT] Request body:', JSON.stringify(body, null, 2))

    // Validate required fields
    if (!body.title || !body.category) {
      console.error('[PUT] Validation failed: Missing title or category')
      return NextResponse.json(
        { error: 'Title and category are required' },
        { status: 400 }
      )
    }

    if (!body.personas || !Array.isArray(body.personas) || body.personas.length === 0) {
      console.error('[PUT] Validation failed: No personas provided')
      return NextResponse.json(
        { error: 'At least one persona is required' },
        { status: 400 }
      )
    }

    // Check for duplicate persona_types
    const personaTypes = body.personas.map((p: any) => p.persona_type)
    const uniquePersonaTypes = new Set(personaTypes)
    if (personaTypes.length !== uniquePersonaTypes.size) {
      console.error('[PUT] Validation failed: Duplicate persona types found:', personaTypes)
      return NextResponse.json(
        { error: 'Duplicate persona types are not allowed' },
        { status: 400 }
      )
    }

    console.log('[PUT] Personas to save:', body.personas.length)
    body.personas.forEach((p: any, idx: number) => {
      console.log(`[PUT] Persona ${idx + 1}: ${p.persona_type}, Countries: ${p.countries.length}`)
      p.countries.forEach((c: any, cIdx: number) => {
        console.log(`[PUT]   Country ${cIdx + 1}: ${c.country}, Slides: ${c.slides.length}`)
      })
    })

    // Update basic idea fields
    console.log('[PUT] Updating idea basic fields...')
    const updatedIdea = await updateIdea(params.id, {
      title: body.title,
      category: body.category,
      description: body.description || null,
    })
    console.log('[PUT] Idea updated:', updatedIdea.id, updatedIdea.title)

    // Use UPSERT pattern instead of delete/recreate to avoid transaction isolation issues
    // For each persona: check if exists, use existing ID or create new one
    console.log('[PUT] Upserting personas, countries, and slides...')
    
    for (let i = 0; i < body.personas.length; i++) {
      const personaData = body.personas[i]
      console.log(`[PUT] Processing persona ${i + 1}/${body.personas.length}: ${personaData.persona_type}`)
      
      // Check if persona_variant already exists
      const { data: existingPersona, error: checkError } = await supabaseServer
        .from('persona_variants')
        .select('id')
        .eq('idea_id', params.id)
        .eq('persona_type', personaData.persona_type)
        .maybeSingle()

      if (checkError) {
        console.error(`[PUT] Error checking for existing persona:`, checkError)
        throw checkError
      }

      let personaVariant
      
      if (existingPersona) {
        // Persona exists - use existing ID and update if needed
        console.log(`[PUT] Persona ${personaData.persona_type} exists, using ID:`, existingPersona.id)
        
        // Update the persona_variant (in case template_id changed)
        const { data: updatedPersona, error: updateError } = await supabaseServer
          .from('persona_variants')
          .update({
            slide_template_id: DEFAULT_TEMPLATE_ID,
          })
          .eq('id', existingPersona.id)
          .select()
          .single()

        if (updateError) {
          console.error(`[PUT] Error updating persona:`, updateError)
          throw updateError
        }
        personaVariant = updatedPersona
      } else {
        // Persona doesn't exist - insert new one
        console.log(`[PUT] Persona ${personaData.persona_type} doesn't exist, creating new...`)
        
        const { data: newPersona, error: insertError } = await supabaseServer
          .from('persona_variants')
          .insert({
            idea_id: params.id,
            persona_type: personaData.persona_type,
            slide_template_id: DEFAULT_TEMPLATE_ID,
          })
          .select()
          .single()

        if (insertError) {
          console.error(`[PUT] Error creating persona ${personaData.persona_type}:`, insertError)
          console.error(`[PUT] Error details:`, {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
          })
          throw insertError
        }
        personaVariant = newPersona
        console.log(`[PUT] Created persona_variant:`, personaVariant.id)
      }

      processedPersonaIds.set(personaData.persona_type, personaVariant.id)

      // Handle countries for this persona
      // First, get existing countries for this persona
      const { data: existingCountries, error: fetchCountriesError } = await supabaseServer
        .from('country_variants')
        .select('id, country')
        .eq('persona_variant_id', personaVariant.id)

      if (fetchCountriesError) {
        console.error(`[PUT] Error fetching existing countries:`, fetchCountriesError)
        throw fetchCountriesError
      }
      console.log(`[PUT]   Found ${existingCountries?.length || 0} existing countries for persona`)

      // Delete all existing countries for this persona (we'll recreate them)
      if (existingCountries && existingCountries.length > 0) {
        const countryIds = existingCountries.map(c => c.id)
        console.log(`[PUT]   Deleting ${countryIds.length} existing countries...`)
        
        const { error: deleteCountriesError } = await supabaseServer
          .from('country_variants')
          .delete()
          .in('id', countryIds)

        if (deleteCountriesError) {
          console.error(`[PUT] Error deleting existing countries:`, deleteCountriesError)
          throw deleteCountriesError
        }
        console.log(`[PUT]   Deleted existing countries`)
      }

      // Create new countries for this persona
      for (let j = 0; j < personaData.countries.length; j++) {
        const countryData = personaData.countries[j]
        console.log(`[PUT]   Creating country ${j + 1}/${personaData.countries.length}: ${countryData.country}`)
        
        const { data: countryVariant, error: countryError } = await supabaseServer
          .from('country_variants')
          .insert({
            persona_variant_id: personaVariant.id,
            country: countryData.country,
            status: 'draft',
          })
          .select()
          .single()

        if (countryError) {
          console.error(`[PUT] Error creating country ${countryData.country}:`, countryError)
          throw countryError
        }
        console.log(`[PUT]   Created country_variant:`, countryVariant.id)

        // Delete existing slides for this country (if any exist)
        const { error: deleteSlidesError } = await supabaseServer
          .from('slide_contents')
          .delete()
          .eq('country_variant_id', countryVariant.id)

        if (deleteSlidesError) {
          console.error(`[PUT] Error deleting existing slides:`, deleteSlidesError)
          throw deleteSlidesError
        }

        // Create slide contents for this country variant
        if (countryData.slides.length > 0) {
          console.log(`[PUT]     Creating ${countryData.slides.length} slides...`)

          for (let k = 0; k < countryData.slides.length; k++) {
            const slide = countryData.slides[k]
            const { data: slideRow, error: slideError } = await supabaseServer
              .from('slide_contents')
              .insert({
                country_variant_id: countryVariant.id,
                slide_number: slide.slide_number,
                slide_type: slide.slide_type,
                title: slide.title || null,
                notes: slide.notes || null,
                content:
                  slide.text_variants && slide.text_variants.length > 0
                    ? slide.text_variants[0].content
                    : '',
              })
              .select()
              .single()

            if (slideError) {
              console.error(`[PUT] Error creating slide ${k + 1}:`, slideError)
              throw slideError
            }

            if (slide.text_variants?.length) {
              const textRows = slide.text_variants
                .filter((variant: any) => variant.content?.trim())
                .map((variant: any, idx: number) => ({
                  slide_id: slideRow.id,
                  variant_label: variant.variant_label || `Variant ${idx + 1}`,
                  content: variant.content,
                  layout_config: variant.layout_config || {},
                  sort_order: idx,
                }))

              if (textRows.length > 0) {
                const { error: textError } = await supabaseServer
                  .from('slide_text_variants')
                  .insert(textRows)
                if (textError) {
                  console.error('[PUT] Error creating text variants:', textError)
                  throw textError
                }
              }
            }

            if (slide.image_variants?.length) {
              const imageRows = slide.image_variants
                .filter((variant: any) => variant.storage_path)
                .map((variant: any, idx: number) => ({
                  slide_id: slideRow.id,
                  variant_label: variant.variant_label || `Image ${idx + 1}`,
                  storage_path: variant.storage_path,
                  caption: variant.caption || null,
                  aspect_ratio: variant.aspect_ratio || null,
                  metadata: variant.metadata || {},
                  sort_order: idx,
                }))

              if (imageRows.length > 0) {
                const { error: imageError } = await supabaseServer
                  .from('slide_image_variants')
                  .insert(imageRows)
                if (imageError) {
                  console.error('[PUT] Error creating image variants:', imageError)
                  throw imageError
                }
              }
            }
          }
        } else {
          console.log(`[PUT]     No slides to create for ${countryData.country}`)
        }
      }
    }

  console.log('[PUT] Deduplicating persona_variants by persona_type...')
  const { data: allPersonasForDedup, error: dedupFetchError } = await supabaseServer
    .from('persona_variants')
    .select('id, persona_type')
    .eq('idea_id', params.id)

  if (dedupFetchError) {
    console.error('[PUT] Error fetching personas for deduplication:', dedupFetchError)
    throw dedupFetchError
  }

  if (allPersonasForDedup && allPersonasForDedup.length > 0) {
    const personaTypeKeepMap = new Map<string, string>()
    const duplicatePersonaIds: string[] = []

    for (const persona of allPersonasForDedup) {
      const preferredId = processedPersonaIds.get(persona.persona_type)
      if (preferredId) {
        if (!personaTypeKeepMap.has(persona.persona_type)) {
          personaTypeKeepMap.set(persona.persona_type, preferredId)
        }
        if (persona.id !== preferredId) {
          duplicatePersonaIds.push(persona.id)
        }
      } else {
        if (!personaTypeKeepMap.has(persona.persona_type)) {
          personaTypeKeepMap.set(persona.persona_type, persona.id)
        } else {
          duplicatePersonaIds.push(persona.id)
        }
      }
    }

    if (duplicatePersonaIds.length > 0) {
      console.log(`[PUT] Deleting ${duplicatePersonaIds.length} duplicate persona_variants...`)
      const { error: deleteDupError } = await supabaseServer
        .from('persona_variants')
        .delete()
        .in('id', duplicatePersonaIds)

      if (deleteDupError) {
        console.error('[PUT] Error deleting duplicate personas:', deleteDupError)
        throw deleteDupError
      }
    }
  }

    // Delete any persona_variants that weren't in the incoming list (cleanup orphans)
    const incomingPersonaTypes = body.personas.map((p: any) => p.persona_type)
    console.log('[PUT] Cleaning up orphaned persona_variants (not in incoming list)...')
    
    const { data: allPersonas, error: fetchAllError } = await supabaseServer
      .from('persona_variants')
      .select('id, persona_type')
      .eq('idea_id', params.id)

    if (fetchAllError) {
      console.error('[PUT] Error fetching all personas for cleanup:', fetchAllError)
      throw fetchAllError
    }

    if (allPersonas && allPersonas.length > 0) {
      const orphanedPersonas = allPersonas.filter(
        p => !incomingPersonaTypes.includes(p.persona_type)
      )

      if (orphanedPersonas.length > 0) {
        const orphanedIds = orphanedPersonas.map(p => p.id)
        console.log(`[PUT] Deleting ${orphanedPersonas.length} orphaned personas:`, orphanedPersonas.map(p => p.persona_type))
        
        const { error: deleteOrphansError } = await supabaseServer
          .from('persona_variants')
          .delete()
          .in('id', orphanedIds)

        if (deleteOrphansError) {
          console.error('[PUT] Error deleting orphaned personas:', deleteOrphansError)
          throw deleteOrphansError
        }
        console.log('[PUT] Deleted orphaned personas')
      } else {
        console.log('[PUT] No orphaned personas to delete')
      }
    }

    // Fetch and return the full updated idea to verify data was saved
    console.log('[PUT] Fetching updated idea with details...')
    const updatedIdeaWithDetails = await getIdeaWithDetails(params.id)
    console.log('[PUT] Updated idea fetched:', {
      id: updatedIdeaWithDetails.id,
      title: updatedIdeaWithDetails.title,
      personas: updatedIdeaWithDetails.personas.length,
    })

    console.log('[PUT] Update completed successfully')
    return NextResponse.json({ idea: updatedIdeaWithDetails }, { status: 200 })
  } catch (error: any) {
    console.error('[PUT] Error updating idea:', error)
    console.error('[PUT] Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
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
    console.log('[DELETE /api/ideas/[id]] Deleting idea:', params.id)
    
    await deleteIdea(params.id)
    
    console.log('[DELETE] Idea deleted successfully')
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[DELETE] Error deleting idea:', error)
    console.error('[DELETE] Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return NextResponse.json(
      { error: error.message || 'Failed to delete idea' },
      { status: 500 }
    )
  }
}

