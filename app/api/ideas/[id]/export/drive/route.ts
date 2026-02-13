import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { 
  getIdeaWithDetailsV2, 
  getPostInstances,
  updatePostInstanceStatus,
} from '@/lib/db'
import { renderSlide, closeBrowser } from '@/lib/renderer'
import { uploadToGoogleDrive } from '@/lib/google-drive'
import { COUNTRY_LABELS } from '@/lib/constants'
import { getEffectiveSlideChoices } from '@/lib/export-build-layouts'
import { decodeHtmlEntities } from '@/lib/utils'
import type { 
  Persona, 
  Country, 
  PostInstance, 
  PostMetadata,
  SlideLayoutConfig,
} from '@/types'

// Translation helper using Google Translate API (free tier)
async function translateText(text: string, targetLang: 'ar' | 'ms'): Promise<string> {
  // If no API key, return original text (user can add Google Translate API key later)
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_TRANSLATE_API_KEY not set, skipping translation')
    return text
  }
  
  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          target: targetLang,
          source: 'en',
        }),
      }
    )
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    const raw = data.data.translations[0].translatedText || text
    return decodeHtmlEntities(raw)
  } catch (error) {
    console.error('Translation error:', error)
    return text // Fallback to original text
  }
}

// Next.js API route timeout (Vercel free tier: 10s, Pro: 60s, Enterprise: 300s)
// For local dev, this can be longer, but Vercel has limits
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
    // Use folderId from request body, or fall back to environment variable
    const folderId = (body.folderId as string | undefined) || process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!folderId) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_FOLDER_ID is not set. Set it in .env.local or pass folderId in request body.' },
        { status: 400 }
      )
    }

    // Get idea with full structure
    const idea = await getIdeaWithDetailsV2(ideaId)
    if (!idea) {
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      )
    }
    
    // #region agent log
    // fetch('http://127.0.0.1:7242/ingest/c34912e8-8949-4558-91c5-94a445d3bbb9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'export/drive/route.ts:48',message:'Idea loaded, checking image pools',data:{personaCount:idea.personas?.length||0,imagePoolSummary:idea.personas?.map(p=>({persona:p.persona_type,slideCount:p.slides?.length||0,totalImages:p.slides?.reduce((sum,s)=>sum+(s.image_pools?.length||0),0)||0,slides:p.slides?.map(s=>({slideNumber:s.slide_number,imageCount:s.image_pools?.length||0,imageIds:s.image_pools?.map(img=>img.id)||[]}))||[]}))||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'LOAD'})}).catch(()=>{});
    // #endregion

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

    // Build one ZIP per country (download one country at a time from Drive)
    const countryZips = new Map<string, JSZip>()
    const getCountryZip = (country: string) => {
      if (!countryZips.has(country)) countryZips.set(country, new JSZip())
      return countryZips.get(country)!
    }

    console.log(`[export/drive] Starting export for ${posts.length} posts...`)
    
    // Process each post (keep browser open across posts for better performance)
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      try {
        console.log(`[export/drive] Processing post ${i + 1}/${posts.length}: ${post.country} slideshow ${post.post_index}`)
        await updatePostInstanceStatus(post.id, 'generating')
        
        // Find persona data
        const persona = idea.personas.find((p) => p.persona_type === post.persona_type)
        if (!persona) continue

        const countryLabel = COUNTRY_LABELS[post.country] || post.country.toUpperCase()
        const countryZip = getCountryZip(post.country)
        const postFolder = countryZip.folder(`${countryLabel} Slideshow ${post.post_index}`)
        if (!postFolder) continue

        // Render slides – always include ALL slides from the idea; post.choices only provides image/variant picks
        const slideChoices = getEffectiveSlideChoices(persona.slides, post.choices?.slides, post.country)
        console.log(`[export/drive] Rendering ${slideChoices.length} slides for post ${i + 1}...`)
        
        // Process slides in larger batches for maximum speed
        // Target: 140 slides in under 5 minutes = ~2.1s per slide average
        // Reduced from 25 to 15 to avoid network congestion causing partial image loads
        const CONCURRENCY_LIMIT = 15
        const allSlideResults = []
        
        for (let batchStart = 0; batchStart < slideChoices.length; batchStart += CONCURRENCY_LIMIT) {
          const batch = slideChoices.slice(batchStart, batchStart + CONCURRENCY_LIMIT)
          const slideRenderPromises = batch.map(async (slideChoice, slideIdx) => {
          try {
          const slide = persona.slides.find((s) => s.slide_number === slideChoice.slide_number)
          if (!slide) return null

          // Get text content for this country and variant.
          // IMPORTANT: There is **no auto-translate during generation**.
          // All translation must already have been applied in the editor.
          let textPool = slide.text_pools.find(
            (t) => t.country === post.country && t.variant_index === slideChoice.text_variant_index
          )

          // Fallback: if no text_pool found, try other options
          if (!textPool) {
            // Try same country, different variant
            textPool = slide.text_pools.find((t) => t.country === post.country)
            
            // For KSA/MY, try US/UK variants
            if (!textPool && (post.country === 'ksa' || post.country === 'my')) {
              let sourceVariantIndex = post.country === 'ksa' ? 1 : 2
              textPool =
                slide.text_pools.find((t) => t.country === 'us' && t.variant_index === sourceVariantIndex) ??
                slide.text_pools.find((t) => t.country === 'us' && t.variant_index === 1) ??
                slide.text_pools.find((t) => t.country === 'uk' && t.variant_index === sourceVariantIndex) ??
                slide.text_pools.find((t) => t.country === 'uk' && t.variant_index === 1) ??
                undefined
            }
            
            // Last resort: try ANY text_pool for this slide
            if (!textPool && slide.text_pools.length > 0) {
              textPool = slide.text_pools[0]
            }
          }
          
          // Get image - use image_id from choice, or fallback to first image in pool
          let imageUrl: string | undefined
          
          // #region agent log - Track image selection
          fetch('http://127.0.0.1:7242/ingest/c34912e8-8949-4558-91c5-94a445d3bbb9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'export/drive:imageSelection',message:'Image pool check',data:{slideNumber:slide.slide_number,country:post.country,postIndex:post.post_index,imagePoolCount:slide.image_pools?.length||0,choiceImageId:slideChoice.image_id,availableImageIds:slide.image_pools?.map(img=>img.id)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'image-random',hypothesisId:'IMGRAND'})}).catch(()=>{});
          // #endregion
          
          // Try to find image by choice ID
          let selectedImage: any = undefined
          if (slideChoice.image_id && slide.image_pools?.length > 0) {
            selectedImage = slide.image_pools.find((img) => img.id === slideChoice.image_id)
          }
          // If not found (stale ID) or no choice, RANDOMIZE from available images
          // This ensures variety even when image IDs have changed since post generation
          if (!selectedImage && slide.image_pools?.length > 0) {
            const randomIndex = Math.floor(Math.random() * slide.image_pools.length)
            selectedImage = slide.image_pools[randomIndex]
          }
          
          if (selectedImage) {
            // Use publicUrl from metadata if available (constructed by getIdeaWithDetailsV2)
            if (selectedImage.metadata?.publicUrl) {
              imageUrl = selectedImage.metadata.publicUrl
            } else if (selectedImage.storage_path) {
              // Fallback: construct URL if metadata.publicUrl wasn't set
              // Use same bucket logic as upload route and getIdeaWithDetailsV2
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
              const bucket = process.env.SLIDE_ASSETS_BUCKET || process.env.NEXT_PUBLIC_SLIDE_ASSETS_BUCKET || 'slide-assets'
              imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${selectedImage.storage_path}`
            }
          }
          
          // Build layout config for rendering
          let layoutConfig: SlideLayoutConfig
          
          // #region agent log - Track layer building
          const savedLayers = (textPool?.layout_config as any)?.layers || []
          const firstLayerText = savedLayers[0]?.text || ''
          fetch('http://127.0.0.1:7242/ingest/c34912e8-8949-4558-91c5-94a445d3bbb9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'export/drive:buildLayout',message:'Building layout',data:{slideNumber:slide.slide_number,country:post.country,imageUrl:imageUrl?.substring(0,100)||'none',firstLayerText:firstLayerText,textHasNewline:firstLayerText.includes('\n'),textLength:firstLayerText.length},timestamp:Date.now(),sessionId:'debug-session',runId:'text-wrap',hypothesisId:'H1-NEWLINE'})}).catch(()=>{});
          // #endregion
          
          if (textPool?.layout_config) {
            const savedLayout = textPool.layout_config as SlideLayoutConfig
            
            layoutConfig = {
              ...savedLayout,
              background: {
                color: savedLayout.background?.color || '#0F1A2C',
                // Use imageUrl if provided, otherwise keep the saved image from layout_config
                image: imageUrl || savedLayout.background?.image || undefined,
              },
              // Use saved layers if available and non-empty, otherwise create fallback
              layers: (savedLayout.layers && savedLayout.layers.length > 0)
                ? savedLayout.layers.map((layer) => {
                    const layerText = layer.text || ''
                    return {
                      ...layer,
                      text: layerText || textPool.content || '',
                    }
                  })
                : (textPool.content ? [{
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
                    position: { x: 540, y: 960 },
                    size: { width: 700, height: 200 },
                    rotation: 0,
                    scale: { x: 1, y: 1 },
                    opacity: 1,
                    zIndex: 0,
                  }] : []),
            }
          } else {
            // Fallback: create default layout with centered text
            layoutConfig = {
              version: 1,
              canvas: { width: 1080, height: 1920 },
              safeZone: { top: 180, bottom: 220 },
              background: { 
                color: '#0F1A2C',
                image: imageUrl || undefined,
              },
              layers: textPool?.content ? [{
                id: `auto-${slide.slide_number}`,
                type: 'text' as const,
                text: textPool.content,
                fontFamily: '"Inter", sans-serif',
                fontWeight: '700',
                fontSize: 60,
                color: '#ffffff',
                strokeColor: '#000000',
                strokeWidth: 4,
                background: 'transparent',
                align: 'center' as const,
                position: { x: 540, y: 960 }, // Center of 1080x1920
                size: { width: 700, height: 200 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                opacity: 1,
                zIndex: 0,
              }] : [],
            }
          }
          
          // Render slide (node-canvas, no browser — matches editor Konva preview)
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
          } catch (err) {
            console.error(`[export/drive] Error rendering slide:`, err)
            return null // Continue even if one slide fails
          }
          })


          // Wait for batch to complete
          const batchResults = await Promise.all(slideRenderPromises)
          allSlideResults.push(...batchResults)
        }
        
        const slideResults = allSlideResults
        console.log(`[export/drive] Completed ${slideResults.filter(r => r !== null).length}/${slideChoices.length} slides for post ${i + 1}`)
        const slideMetadata: PostMetadata['slides'] = []

        for (const result of slideResults) {
          if (!result) continue
          postFolder.file(
            `slide-${String(result.slideNumber).padStart(2, '0')}.jpg`,
            result.imageBuffer
          )

          slideMetadata.push({
            slide_number: result.slideNumber,
            slide_type: result.slide_type,
            image_used: result.image_used,
            text_variant_used: result.text_variant_used,
            text_content: result.text_content,
          })
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

        postFolder.file('metadata.json', JSON.stringify(metadata, null, 2))

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

    // Generate and upload one ZIP per country in parallel
    const ideaSlug = sanitizeFilename(idea.title)
    const uploadPromises = Array.from(countryZips.entries()).map(async ([country, zip]) => {
      const countryLabel = COUNTRY_LABELS[country as keyof typeof COUNTRY_LABELS] || country.toUpperCase()
      const zipBuffer = await zip.generateAsync({ 
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      return uploadToGoogleDrive({
        fileBuffer: zipBuffer,
        fileName: `${ideaSlug}-${countryLabel}.zip`,
        folderId,
        mimeType: 'application/zip',
      })
    })

    console.log(`[export/drive] Uploading ${uploadPromises.length} country zips to Drive...`)
    await Promise.all(uploadPromises)

    const folderLink = `https://drive.google.com/drive/folders/${folderId}`
    return NextResponse.json({
      success: true,
      fileId: folderId,
      webViewLink: folderLink,
      message: `Exported and uploaded ${uploadPromises.length} country zips to Google Drive.`,
    })
  } catch (error: any) {
    console.error('[export/drive] Error:', error)
    console.error('[export/drive] Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Export failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
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
