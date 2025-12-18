import { supabaseServer } from './supabase'
import type {
  Idea,
  SlideContent,
  SlideTextVariant,
  SlideImageVariant,
  RenderJob,
  JobPriority,
  JobStatus,
  SlideLayoutConfig,
} from '@/types'

// Get default template ID (from database.sql)
const DEFAULT_TEMPLATE_ID = '00000000-0000-0000-0000-000000000001'
const MOCK_RENDER_PLACEHOLDER_BASE =
  'https://placehold.co/1080x1920/0f1a2c/e0c88c?text='
const MOCK_RENDER_DELAY_MS = 180

export async function getIdeas() {
  console.log('[getIdeas] Fetching all ideas from database...')
  console.log('[getIdeas] Supabase client configured:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
  })
  
  const { data, error } = await supabaseServer
    .from('ideas')
    .select('*')
    .order('created_at', { ascending: false })

  console.log('[getIdeas] Raw data from Supabase:', data)
  console.log('[getIdeas] Error (if any):', error)
  console.log('[getIdeas] Number of ideas returned:', data?.length || 0)
  
  if (data && data.length > 0) {
    console.log('[getIdeas] Idea IDs:', data.map(i => i.id))
    console.log('[getIdeas] Idea titles:', data.map(i => i.title))
  }

  if (error) {
    console.error('[getIdeas] Supabase error:', error)
    throw error
  }
  
  return data as Idea[]
}

export async function getIdeaById(id: string) {
  const { data, error } = await supabaseServer
    .from('ideas')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Idea
}

export async function getIdeaWithDetails(id: string) {
  await deduplicateVariantsForIdea(id)

  // Get idea
  const idea = await getIdeaById(id)

  // Get persona variants
  const { data: personas, error: personasError } = await supabaseServer
    .from('persona_variants')
    .select('*')
    .eq('idea_id', id)

  if (personasError) throw personasError

  // Get country variants and slide contents for each persona
  const personasWithDetails = await Promise.all(
    (personas || []).map(async (persona) => {
      const { data: countries, error: countriesError } = await supabaseServer
        .from('country_variants')
        .select('*')
        .eq('persona_variant_id', persona.id)

      if (countriesError) throw countriesError

      const countriesWithSlides = await Promise.all(
        (countries || []).map(async (country) => {
          const { data: slides, error: slidesError } = await supabaseServer
            .from('slide_contents')
            .select('*')
            .eq('country_variant_id', country.id)
            .order('slide_number', { ascending: true })

          if (slidesError) throw slidesError

          const slidesWithVariants = await Promise.all(
            (slides || []).map(async (slide: any) => {
              const textVariants = await fetchSlideVariants<SlideTextVariant>(
                'slide_text_variants',
                slide.id
              )
              const imageVariants = await fetchSlideVariants<SlideImageVariant>(
                'slide_image_variants',
                slide.id
              )

              return {
                id: slide.id,
                country_variant_id: slide.country_variant_id,
                slide_number: slide.slide_number,
                slide_type: slide.slide_type,
                content: slide.content,
                title: slide.title,
                notes: slide.notes,
                created_at: slide.created_at,
                text_variants: textVariants,
                image_variants: imageVariants,
              }
            })
          )

          return { ...country, slides: slidesWithVariants }
        })
      )

      return { ...persona, countries: countriesWithSlides }
    })
  )

  return {
    ...idea,
    personas: personasWithDetails,
  }
}

export async function createIdea(data: {
  title: string
  category: string
  description?: string
  personas: {
    persona_type: 'main' | 'male' | 'female'
    countries: {
      country: 'uk' | 'us' | 'ksa' | 'my'
      slides: {
        slide_number: number
        slide_type: string
        title?: string
        notes?: string
        text_variants: {
          variant_label: string
          content: string
          layout_config?: SlideLayoutConfig | null
        }[]
        image_variants: {
          variant_label: string
          storage_path: string
          caption?: string
          aspect_ratio?: string
          metadata?: Record<string, any>
        }[]
      }[]
    }[]
  }[]
}) {
  // 1. Create the idea
  const { data: idea, error: ideaError } = await supabaseServer
    .from('ideas')
    .insert({
      title: data.title,
      category: data.category,
      description: data.description || null,
    })
    .select()
    .single()

  if (ideaError) throw ideaError

  // 2. Create persona variants
  for (const personaData of data.personas) {
    const { data: personaVariant, error: personaError } = await supabaseServer
      .from('persona_variants')
      .insert({
        idea_id: idea.id,
        persona_type: personaData.persona_type,
        slide_template_id: DEFAULT_TEMPLATE_ID,
      })
      .select()
      .single()

    if (personaError) throw personaError

    // 3. Create country variants for this persona
    for (const countryData of personaData.countries) {
      const { data: countryVariant, error: countryError } = await supabaseServer
        .from('country_variants')
        .insert({
          persona_variant_id: personaVariant.id,
          country: countryData.country,
          status: 'draft',
        })
        .select()
        .single()

      if (countryError) throw countryError

      // 4. Create slide contents for this country variant
      if (countryData.slides.length > 0) {
        for (const slide of countryData.slides) {
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

          if (slideError) throw slideError

          if (slide.text_variants?.length) {
            const textRows = slide.text_variants
              .filter((variant) => variant.content.trim().length > 0)
              .map((variant, idx) => ({
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
              if (textError) throw textError
            }
          }

          if (slide.image_variants?.length) {
            const imageRows = slide.image_variants
              .filter((variant) => variant.storage_path)
              .map((variant, idx) => ({
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
              if (imageError) throw imageError
            }
          }
        }
      }
    }
  }

  return idea
}

export async function updateIdea(id: string, data: Partial<Idea>) {
  const { data: idea, error } = await supabaseServer
    .from('ideas')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return idea as Idea
}

async function deduplicateVariantsForIdea(ideaId: string) {
  const { data: personas, error: personasError } = await supabaseServer
    .from('persona_variants')
    .select('id, persona_type')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true })

  if (personasError) {
    console.error('[deduplicateVariants] Failed to fetch personas:', personasError)
    throw personasError
  }

  if (!personas || personas.length === 0) {
    return
  }

  const personaKeepMap = new Map<string, string>()
  const personaDuplicates: string[] = []

  for (const persona of personas) {
    const existing = personaKeepMap.get(persona.persona_type)
    if (existing) {
      personaDuplicates.push(persona.id)
    } else {
      personaKeepMap.set(persona.persona_type, persona.id)
    }
  }

  if (personaDuplicates.length > 0) {
    console.log(`[deduplicateVariants] Removing ${personaDuplicates.length} duplicate persona_variants for idea ${ideaId}`)
    const { error: deletePersonaError } = await supabaseServer
      .from('persona_variants')
      .delete()
      .in('id', personaDuplicates)

    if (deletePersonaError) {
      console.error('[deduplicateVariants] Failed to delete duplicate personas:', deletePersonaError)
      throw deletePersonaError
    }
  }

  const personaIdsToCheck = personas
    .filter((persona) => !personaDuplicates.includes(persona.id))
    .map((persona) => persona.id)

  for (const personaId of personaIdsToCheck) {
    const { data: countries, error: countriesError } = await supabaseServer
      .from('country_variants')
      .select('id, country')
      .eq('persona_variant_id', personaId)
      .order('created_at', { ascending: true })

    if (countriesError) {
      console.error('[deduplicateVariants] Failed to fetch countries:', countriesError)
      throw countriesError
    }

    if (!countries || countries.length === 0) continue

    const countryKeepMap = new Map<string, string>()
    const countryDuplicates: string[] = []

    for (const country of countries) {
      const existing = countryKeepMap.get(country.country)
      if (existing) {
        countryDuplicates.push(country.id)
      } else {
        countryKeepMap.set(country.country, country.id)
      }
    }

    if (countryDuplicates.length > 0) {
      console.log(`[deduplicateVariants] Removing ${countryDuplicates.length} duplicate country_variants for persona ${personaId}`)
      const { error: deleteCountryError } = await supabaseServer
        .from('country_variants')
        .delete()
        .in('id', countryDuplicates)

      if (deleteCountryError) {
        console.error('[deduplicateVariants] Failed to delete duplicate countries:', deleteCountryError)
        throw deleteCountryError
      }
    }
  }
}

export async function deleteIdea(id: string) {
  // Delete the idea - cascade will handle related records (persona_variants, country_variants, slide_contents)
  const { error } = await supabaseServer
    .from('ideas')
    .delete()
    .eq('id', id)

  if (error) throw error
  return { success: true }
}

export async function createRenderJob(data: {
  idea_id: string
  persona_type: string
  country: string
  template_id?: string
  status?: JobStatus
  priority?: JobPriority
  batch_id?: string
}): Promise<RenderJob> {
  const { data: job, error } = await supabaseServer
    .from('render_jobs')
    .insert({
      idea_id: data.idea_id,
      persona_type: data.persona_type,
      country: data.country,
      template_id: data.template_id || null,
      status: data.status || 'queued',
      priority: data.priority || 'normal',
      batch_id: data.batch_id || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return job as RenderJob
}

export async function createRenderJobsForIdea(
  ideaId: string,
  options?: { priority?: JobPriority; batchId?: string; force?: boolean }
) {
  const idea = await getIdeaWithDetails(ideaId)
  const batchId = options?.batchId || `${ideaId}-${Date.now()}`
  const existingJobs = await getRenderJobs({ ideaId })
  const existingKeyMap = new Map<string, RenderJob>(
    existingJobs.map((job) => [`${job.persona_type}:${job.country}`, job])
  )

  const newJobs: RenderJob[] = []

  for (const persona of idea.personas || []) {
    for (const country of persona.countries || []) {
      const key = `${persona.persona_type}:${country.country}`

      if (existingKeyMap.has(key) && !options?.force) {
        continue
      }

      if (options?.force && existingKeyMap.has(key)) {
        const existing = existingKeyMap.get(key)
        if (existing) {
          await deleteRenderJob(existing.id)
          existingKeyMap.delete(key)
        }
      }

      const job = await createRenderJob({
        idea_id: ideaId,
        persona_type: persona.persona_type,
        country: country.country,
        priority: options?.priority || 'normal',
        batch_id: batchId,
      })

      newJobs.push(job)
    }
  }

  return {
    jobsCreated: newJobs.length,
    jobs: newJobs,
    batchId,
  }
}

export async function getRenderJobs(filters?: {
  status?: JobStatus
  priority?: JobPriority
  ideaId?: string
}) {
  let query = supabaseServer.from('render_jobs').select('*').order('created_at', {
    ascending: false,
  })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }
  if (filters?.ideaId) {
    query = query.eq('idea_id', filters.ideaId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as RenderJob[]
}

export async function getRenderJobById(id: string) {
  const { data, error } = await supabaseServer
    .from('render_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as RenderJob
}

export async function updateRenderJobStatus(
  id: string,
  status: JobStatus,
  options?: { errorMessage?: string; outputUrl?: string | null }
) {
  const payload: Record<string, any> = {
    status,
    error_message: options?.errorMessage || null,
    updated_at: new Date().toISOString(),
  }

  if (options && 'outputUrl' in options) {
    payload.output_url = options.outputUrl
  }

  const { data, error } = await supabaseServer
    .from('render_jobs')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as RenderJob
}

export async function deleteRenderJob(id: string) {
  const { error } = await supabaseServer.from('render_jobs').delete().eq('id', id)
  if (error) throw error
  return { success: true }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runMockRenderJobs(jobIds?: string[]) {
  let jobs: RenderJob[] = []

  if (jobIds && jobIds.length > 0) {
    const { data, error } = await supabaseServer
      .from('render_jobs')
      .select('*')
      .in('id', jobIds)

    if (error) throw error
    jobs = (data || []) as RenderJob[]
  } else {
    jobs = await getRenderJobs({ status: 'queued' })
  }

  const processed: RenderJob[] = []

  for (const job of jobs) {
    await updateRenderJobStatus(job.id, 'generating')
    await delay(MOCK_RENDER_DELAY_MS)
    const placeholderUrl = `${MOCK_RENDER_PLACEHOLDER_BASE}${encodeURIComponent(
      `${job.persona_type.toUpperCase()}-${job.country.toUpperCase()}`
    )}`
    const completed = await updateRenderJobStatus(job.id, 'complete', {
      outputUrl: placeholderUrl,
    })
    processed.push(completed)
  }

  return processed
}

async function fetchSlideVariants<T>(
  table: 'slide_text_variants' | 'slide_image_variants',
  slideId: string
): Promise<T[]> {
  try {
    const { data, error } = await supabaseServer
      .from(table)
      .select('*')
      .eq('slide_id', slideId)
      .order('sort_order', { ascending: true })

    if (error) {
      // Fall back gracefully if table doesn't exist yet
      if (
        error.code === 'PGRST200' &&
        error.message?.includes(`relationship between 'slide_contents' and '${table}'`)
      ) {
        console.warn(`[fetchSlideVariants] ${table} not available yet, returning empty array.`)
        return []
      }
      throw error
    }

    return (data || []) as T[]
  } catch (err: any) {
    if (
      err?.code === 'PGRST200' &&
      err?.message?.includes(`relationship between 'slide_contents' and '${table}'`)
    ) {
      console.warn(`[fetchSlideVariants] ${table} not available yet, returning empty array.`)
      return []
    }
    throw err
  }
}

