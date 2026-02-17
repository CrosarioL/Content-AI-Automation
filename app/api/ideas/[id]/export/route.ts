import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { 
  getIdeaWithDetailsV2, 
  getPostInstances,
  updatePostInstanceStatus,
} from '@/lib/db'
import { renderSlide, closeBrowser } from '@/lib/renderer'
import { compileVideo } from '@/lib/video-compiler'
import { COUNTRY_LABELS } from '@/lib/constants'
import { getEffectiveSlideChoices } from '@/lib/export-build-layouts'
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
    const flatPhotos = body.flatPhotos === true

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

    // Create ZIP
    const zip = new JSZip()
    const ideaFolderName = sanitizeFilename(idea.title)
    const ideaFolder = zip.folder(ideaFolderName)
    
    if (!ideaFolder) {
      throw new Error('Failed to create ZIP folder')
    }

    // Optional: "one folder of photos" mode for iPad (minimize nesting)
    const photosFolder = flatPhotos ? (ideaFolder.folder('Photos') ?? ideaFolder) : null

    // Process each post (keep browser open across posts for better performance)
    const orderedPosts = [...posts].sort((a, b) => {
      const c = String(a.country).localeCompare(String(b.country))
      if (c !== 0) return c
      const p = (a.post_index ?? 0) - (b.post_index ?? 0)
      if (p !== 0) return p
      return String(a.persona_type).localeCompare(String(b.persona_type))
    })

    let globalIndex = 0

    for (const post of orderedPosts) {
      try {
        await updatePostInstanceStatus(post.id, 'generating')
        
        // Find persona data
        const persona = idea.personas.find((p) => p.persona_type === post.persona_type)
        if (!persona) continue

        // Create post folder with better naming: "UK Slideshow 1", "US Slideshow 2", etc.
        const countryLabel = COUNTRY_LABELS[post.country] || post.country.toUpperCase()
        const postFolder = flatPhotos
          ? (ideaFolder.folder('metadata') ?? ideaFolder)
          : (ideaFolder.folder(post.country)?.folder(`${countryLabel} Slideshow ${post.post_index}`) ?? null)
        const slidesFolder = flatPhotos
          ? photosFolder
          : (postFolder ? postFolder.folder('slides') : null)
        if (!slidesFolder) continue

        // Render each slide – include ALL slides from the idea
        const slideChoices = getEffectiveSlideChoices(persona.slides, post.choices?.slides, post.country)
        const slideRenderPromises = slideChoices.map(async (slideChoice) => {
          const slide = persona.slides.find((s) => s.slide_number === slideChoice.slide_number)
          if (!slide) return null

          // Get text content for this country and variant
          const textPool = slide.text_pools.find(
            (t) => t.country === post.country && t.variant_index === slideChoice.text_variant_index
          )
          
          // Get image if specified
          let imageUrl: string | undefined
          if (slideChoice.image_id) {
            const image = slide.image_pools.find((img) => img.id === slideChoice.image_id)
            if (image?.storage_path) {
              // Construct public URL
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
              const bucket = process.env.SLIDE_ASSETS_BUCKET || 'slide-assets'
              imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${image.storage_path}`
            }
          }

          // Build layout config for rendering
          let layoutConfig: SlideLayoutConfig
          
          if (textPool?.layout_config) {
            const savedLayout = textPool.layout_config as SlideLayoutConfig
            layoutConfig = {
              ...savedLayout,
              background: {
                color: savedLayout.background?.color || '#0F1A2C',
                image: imageUrl || undefined,
              },
              layers: savedLayout.layers?.map((layer) => {
                const layerText = layer.text || ''
                return {
                  ...layer,
                  text: layerText || textPool.content || '',
                }
              }) || (textPool.content ? [{
                id: `auto-${slide.slide_number}`,
                type: 'text' as const,
                text: textPool.content,
                fontFamily: '"Inter", sans-serif',
                fontWeight: '700',
                fontSize: 72,
                color: '#ffffff',
                strokeColor: '#000000',
                strokeWidth: 4,
                background: 'transparent',
                align: 'center' as const,
                position: { x: 300, y: 720 },
                size: { width: 480, height: 480 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                opacity: 1,
                zIndex: 0,
              }] : []),
            }
          } else {
            // Fallback: create default layout
            layoutConfig = {
              version: 1,
              canvas: { width: 1080, height: 1920 },
              safeZone: { top: 180, bottom: 220 },
              background: { 
                color: '#0F1A2C',
                image: imageUrl,
              },
              layers: textPool?.content ? [{
                id: `auto-${slide.slide_number}`,
                type: 'text' as const,
                text: textPool.content,
                fontFamily: '"Inter", sans-serif',
                fontWeight: '700',
                fontSize: 72,
                color: '#ffffff',
                strokeColor: '#000000',
                strokeWidth: 4,
                background: 'transparent',
                align: 'center' as const,
                position: { x: 300, y: 720 },
                size: { width: 480, height: 480 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                opacity: 1,
                zIndex: 0,
              }] : [],
            }
          }

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
        const orderedResults = slideResults
          .filter((r): r is NonNullable<typeof r> => Boolean(r))
          .sort((a, b) => a.slideNumber - b.slideNumber)

        for (const result of orderedResults) {
          if (!result) continue
          
          slideBuffers.push({
            slideNumber: result.slideNumber,
            imageBuffer: result.imageBuffer,
          })

          const slideNo = String(result.slideNumber).padStart(2, '0')
          if (flatPhotos) {
            globalIndex += 1
            const idx = String(globalIndex).padStart(4, '0')
            const postNo = String(post.post_index).padStart(2, '0')
            slidesFolder.file(`${idx}-${countryLabel}-S${postNo}-slide-${slideNo}.jpg`, result.imageBuffer)
          } else {
            slidesFolder.file(`slide-${slideNo}.jpg`, result.imageBuffer)
          }

          slideMetadata.push({
            slide_number: result.slideNumber,
            slide_type: result.slide_type,
            image_used: result.image_used,
            text_variant_used: result.text_variant_used,
            text_content: result.text_content,
          })
        }

        // Skip video compilation for faster exports (can be enabled via query param)
        // Video compilation is very slow - users can compile videos separately if needed
        const includeVideos = body.includeVideos === true
        if (includeVideos && slideBuffers.length > 0) {
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
            // `postFolder` can be null in flat export mode; video is optional anyway.
            postFolder?.file('video.mp4', videoResult.videoBuffer)
          }
        }

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

        // In flatPhotos mode, keep metadata separate (avoid nesting in Photos folder)
        if (flatPhotos) {
          const metaFolder = ideaFolder.folder('metadata') ?? ideaFolder
          const postNo = String(post.post_index).padStart(2, '0')
          metaFolder.file(`${countryLabel}-S${postNo}-metadata.json`, JSON.stringify(metadata, null, 2))
        } else {
          postFolder?.file('metadata.json', JSON.stringify(metadata, null, 2))
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
    return new NextResponse(zipBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${ideaFolderName}-${flatPhotos ? 'photos' : 'export'}.zip"`,
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

