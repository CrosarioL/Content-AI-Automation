import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { 
  getIdeaWithDetailsV2, 
  getPostInstances,
  updatePostInstanceStatus,
} from '@/lib/db'
import { renderSlide, closeBrowser } from '@/lib/renderer'
import { compileVideo } from '@/lib/video-compiler'
import { COUNTRY_LABELS, COUNTRIES } from '@/lib/constants'
import { getEffectiveSlideChoices, buildLayoutForSlide } from '@/lib/export-build-layouts'
import type { 
  Persona, 
  Country, 
  PostInstance, 
  PostMetadata,
  SlideLayoutConfig,
} from '@/types'

export const maxDuration = 300 // 5 minutes for full export

const SLIDE_DURATION_SECONDS = 4

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ideaId = params.id

  try {
    const body = await request.json().catch(() => ({}))
    const requestedPersonas = body.personas as Persona[] | undefined
    const requestedCountries = body.countries as Country[] | undefined
    const isFlat = body.flat === true || body.flat === 'true' || body.structure === 'flat'

    // Get idea with full structure
    const idea = await getIdeaWithDetailsV2(ideaId)
    if (!idea) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      )
    }

    // Get all post instances for this idea
    let posts = await getPostInstances({ ideaId })
    
    // Filter by persona if specified
    if (requestedPersonas) {
      posts = posts.filter((p) => requestedPersonas.includes(p.persona_type))
    }
    
    // Filter by country if specified
    if (requestedCountries) {
      posts = posts.filter((p) => requestedCountries.includes(p.country))
    }

    if (posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts found. Generate posts first.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const bucket =
      process.env.SLIDE_ASSETS_BUCKET ||
      process.env.NEXT_PUBLIC_SLIDE_ASSETS_BUCKET ||
      'slide-assets'

    const getImageUrl = (img: any) => {
      if (img.metadata?.publicUrl) return img.metadata.publicUrl
      if (img.storage_path) {
        return `${supabaseUrl}/storage/v1/object/public/${bucket}/${img.storage_path}`
      }
      return undefined
    }

    // Order posts for predictable output
    const countryOrder = new Map(COUNTRIES.map((country, index) => [country, index]))
    const orderedPosts = [...posts].sort((a, b) => {
      const countryDiff = (countryOrder.get(a.country) ?? 999) - (countryOrder.get(b.country) ?? 999)
      if (countryDiff !== 0) return countryDiff
      if (a.post_index !== b.post_index) return a.post_index - b.post_index
      return a.persona_type.localeCompare(b.persona_type)
    })

    const totalSlides = orderedPosts.reduce((sum, post) => {
      const persona = idea.personas.find((p) => p.persona_type === post.persona_type)
      return sum + (persona?.slides.length || 0)
    }, 0)
    const sequencePad = Math.max(4, String(Math.max(totalSlides, 1)).length)
    const maxPostIndex = orderedPosts.reduce(
      (max, post) => Math.max(max, Number(post.post_index) || 0),
      0
    )
    const postIndexPad = Math.max(2, String(Math.max(maxPostIndex, 1)).length)
    const includeVideos = body.includeVideos === true && !isFlat

    // Create ZIP (flat or nested)
    const zip = new JSZip()
    const ideaFolder = isFlat ? null : zip.folder(sanitizeFilename(idea.title))
    
    if (!isFlat && !ideaFolder) {
      throw new Error('Failed to create ZIP folder')
    }

    // Process each post (keep browser open across posts for better performance)
    let flatIndex = 1
    for (const post of orderedPosts) {
      try {
        await updatePostInstanceStatus(post.id, 'generating')
        
        // Find persona data
        const persona = idea.personas.find((p) => p.persona_type === post.persona_type)
        if (!persona) continue

        const countryLabel = COUNTRY_LABELS[post.country] || post.country.toUpperCase()
        const safeCountryLabel = sanitizeFilename(countryLabel)
        const safePersonaLabel = sanitizeFilename(post.persona_type)
        const postIndexLabel = String(post.post_index).padStart(postIndexPad, '0')

        let postFolder: JSZip | null = null
        let slidesFolder: JSZip | null = null

        if (!isFlat) {
          // Create country folder
          const countryFolder = ideaFolder?.folder(post.country)
          if (!countryFolder) continue

          // Create post folder with better naming: "UK Slideshow 1", "US Slideshow 2", etc.
          postFolder = countryFolder.folder(`${countryLabel} Slideshow ${post.post_index}`)
          if (!postFolder) continue

          // Create slides folder
          slidesFolder = postFolder.folder('slides')
          if (!slidesFolder) continue
        }

        // Render each slide – include ALL slides from the idea
        const slideChoices = getEffectiveSlideChoices(persona.slides, post.choices?.slides, post.country)
        const slideRenderPromises = slideChoices.map(async (slideChoice) => {
          const slide = persona.slides.find((s) => s.slide_number === slideChoice.slide_number)
          if (!slide) return null

          const layoutConfig = buildLayoutForSlide(slide, slideChoice, post.country, getImageUrl)
          if (!layoutConfig) return null

          // Render slide (node-canvas, no browser)
          const renderResult = await renderSlide({ layout: layoutConfig })
          
          if (renderResult.success && renderResult.imageBuffer) {
            return {
              slideNumber: slide.slide_number,
              imageBuffer: renderResult.imageBuffer,
              slide_type: slide.slide_type,
              image_used: imageUrl,
              text_variant_used: slideChoice.text_variant_index,
              text_content: textPool?.content || '',
            }
          }
          return null
        })

        // Wait for all slides to render in parallel
        const slideResults = await Promise.all(slideRenderPromises)
        const slideBuffers: Array<{ slideNumber: number; imageBuffer: Buffer }> = []
        const slideMetadata: PostMetadata['slides'] = []

        // Process results and add to ZIP
        for (const result of slideResults) {
          if (!result) continue
          
          const slideNumberLabel = String(result.slideNumber).padStart(2, '0')

          if (isFlat) {
            const sequenceLabel = String(flatIndex).padStart(sequencePad, '0')
            const filename = `${sequenceLabel}-${safeCountryLabel}-${postIndexLabel}-${safePersonaLabel}-slide-${slideNumberLabel}.png`
            zip.file(filename, result.imageBuffer)
            flatIndex += 1
          } else if (slidesFolder) {
            slidesFolder.file(
              `slide-${slideNumberLabel}.png`,
              result.imageBuffer
            )
          }

          if (includeVideos) {
            slideBuffers.push({
              slideNumber: result.slideNumber,
              imageBuffer: result.imageBuffer,
            })
          }

          if (!isFlat) {
            slideMetadata.push({
              slide_number: result.slideNumber,
              slide_type: result.slide_type,
              image_used: result.image_used,
              text_variant_used: result.text_variant_used,
              text_content: result.text_content,
            })
          }
        }

        // Skip video compilation for faster exports (can be enabled via query param)
        // Video compilation is very slow - users can compile videos separately if needed
        if (includeVideos && slideBuffers.length > 0 && postFolder) {
          await updatePostInstanceStatus(post.id, 'encoding')
          
          const videoResult = await compileVideo({
            slideImages: slideBuffers,
            outputFilename: 'video.mp4',
            slideDuration: SLIDE_DURATION_SECONDS,
            ideaId,
            persona: post.persona_type,
            country: post.country,
          })

          if (videoResult.success && videoResult.videoBuffer) {
            postFolder.file('video.mp4', videoResult.videoBuffer)
          }
        }

        if (!isFlat && postFolder) {
          // Create metadata.json
          const metadata: PostMetadata = {
            idea_id: ideaId,
            idea_title: idea.title,
            persona_type: post.persona_type,
            country: post.country,
            post_index: post.post_index,
            seed: post.seed,
            combo_key: post.combo_key,
            choices: post.choices,
            generated_at: new Date().toISOString(),
            slides: slideMetadata,
          }

          postFolder.file('metadata.json', JSON.stringify(metadata, null, 2))
        }

        await updatePostInstanceStatus(post.id, 'complete')
      } catch (postError: any) {
        console.error(`[export] Error processing post ${post.id}:`, postError)
        await updatePostInstanceStatus(post.id, 'failed', {
          errorMessage: postError.message,
        })
      }
    }

    // Close browser after all rendering is complete
    await closeBrowser()

    // Generate ZIP blob
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    // Return ZIP as download
    // NextResponse expects BodyInit; Buffer types can fail TS checks in Next.js build.
    // Convert to Uint8Array for compatibility.
    const zipBody = new Uint8Array(zipBuffer)
    const zipFilename = isFlat
      ? `${sanitizeFilename(idea.title)}-photos.zip`
      : `${sanitizeFilename(idea.title)}-export.zip`

    return new NextResponse(zipBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': String(zipBuffer.length),
      },
    })
  } catch (error: any) {
    console.error('[export] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    )
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50)
}

