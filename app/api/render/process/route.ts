import { NextRequest, NextResponse } from 'next/server'
import {
  getRenderJobById,
  updateRenderJobStatus,
  getIdeaWithDetails,
} from '@/lib/db'
import { renderJobSlides, closeBrowser, renderSlide } from '@/lib/renderer'
import { compileVideo } from '@/lib/video-compiler'
import { translateText } from '@/lib/translation'
import type { SlideLayoutConfig } from '@/types'

export const maxDuration = 300 // Allow up to 5 minutes (was 120s) for rendering + video compilation

export async function POST(request: NextRequest) {
  let jobId: string | undefined

  try {
    const body = await request.json()
    jobId = body.jobId

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      )
    }

    // Get job details
    const job = await getRenderJobById(jobId)
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Only process queued jobs
    if (job.status !== 'queued') {
      return NextResponse.json(
        { error: `Job is not queued (status: ${job.status})` },
        { status: 400 }
      )
    }

    // Update status to generating
    await updateRenderJobStatus(jobId, 'generating')

    // Get idea with all details
    const idea = await getIdeaWithDetails(job.idea_id)
    if (!idea) {
      await updateRenderJobStatus(jobId, 'failed', {
        errorMessage: 'Idea not found',
      })
      return NextResponse.json(
        { error: 'Idea not found' },
        { status: 404 }
      )
    }

    // Find the matching persona and country
    const persona = idea.personas?.find((p) => p.persona_type === job.persona_type)
    if (!persona) {
      await updateRenderJobStatus(jobId, 'failed', {
        errorMessage: `Persona "${job.persona_type}" not found`,
      })
      return NextResponse.json(
        { error: `Persona "${job.persona_type}" not found` },
        { status: 404 }
      )
    }

    const countryData = persona.countries?.find((c: any) => c.country === job.country)
    if (!countryData) {
      await updateRenderJobStatus(jobId, 'failed', {
        errorMessage: `Country "${job.country}" not found for persona "${job.persona_type}"`,
      })
      return NextResponse.json(
        { error: `Country "${job.country}" not found` },
        { status: 404 }
      )
    }

    // Prepare slides for rendering
    const slidesToRender: Array<{ slideNumber: number; layout: SlideLayoutConfig }> = []
    
    // Process slides
    for (const slide of countryData.slides || []) {
      // Default: use the first text variant available for this country
      let textVariant = slide.text_variants?.[0]
      let translatedContent: string | undefined
      
      // Auto-translate logic:
      // - For KSA: Use USA/UK variant 1, translate to Arabic
      // - For Malaysia: Use USA/UK variant 2, translate to Malay
      // If we don't have a variant for this country, OR if it's KSA/MY where we want to auto-translate
      if ((!textVariant && (job.country === 'ksa' || job.country === 'my')) || 
          (job.country === 'ksa' || job.country === 'my')) {
            
        let sourceCountry: 'us' | 'uk' = 'us'
        let sourceVariantIndex = 1 // Default to 1
        
        if (job.country === 'ksa') {
          sourceVariantIndex = 1 // Always use variant 1 for KSA
        } else if (job.country === 'my') {
          sourceVariantIndex = 2 // Always use variant 2 for Malaysia
        }
        
        // Find source variant in USA/UK
        // Need to find the slide data for USA/UK from the idea structure
        // This is tricky because countryData is only for the target country
        // We need to look up the persona's other countries
        
        const sourceCountryData = persona.countries?.find((c: any) => c.country === 'us') || 
                                 persona.countries?.find((c: any) => c.country === 'uk')
        
        if (sourceCountryData) {
          const sourceSlide = sourceCountryData.slides?.find((s: any) => s.slide_number === slide.slide_number)
          if (sourceSlide) {
            const sourceVariant = sourceSlide.text_variants?.find((t: any) => t.variant_index === sourceVariantIndex)
            
            if (sourceVariant) {
              // Found source! Now translate
              const targetLang = job.country === 'ksa' ? 'ar' : 'ms'
              
              try {
                const translatedText = await translateText(sourceVariant.content, targetLang)
                translatedContent = translatedText
                
                // Create a synthetic textVariant using the source layout but with translated text
                textVariant = {
                  ...sourceVariant,
                  content: translatedText,
                  layout_config: sourceVariant.layout_config ? {
                    ...sourceVariant.layout_config,
                    layers: sourceVariant.layout_config.layers?.map((layer: any) => {
                      // Style fix: For Arabic, if text has white background and black text, remove background
                      // This addresses the "formatting off to the left" issue if it's caused by background box
                      if (targetLang === 'ar' && layer.background && layer.background !== 'transparent' && layer.color === '#000000') {
                        return { ...layer, background: 'transparent', text: translatedText }
                      }
                      return { ...layer, text: translatedText }
                    }) || []
                  } : null
                }
              } catch (err) {
                console.error(`Translation failed for ${job.country}:`, err)
                // Fallback to original text if translation fails
                textVariant = sourceVariant
              }
            }
          }
        }
      }
      
      // If we still don't have a variant (e.g. source not found), fallback to whatever is in the slide
      if (!textVariant) {
        textVariant = slide.text_variants?.[0]
      }

      if (textVariant?.layout_config) {
        slidesToRender.push({
          slideNumber: slide.slide_number,
          layout: textVariant.layout_config as SlideLayoutConfig,
        })
      } else if (slide.content || textVariant?.content) {
        // Create a basic layout from content
        const content = textVariant?.content || slide.content || ''
        slidesToRender.push({
          slideNumber: slide.slide_number,
          layout: {
            version: 1,
            canvas: { width: 1080, height: 1920 },
            safeZone: { top: 180, bottom: 220 },
            background: { color: '#0F1A2C' },
            layers: content ? [{
              id: `auto-${slide.slide_number}`,
              type: 'text' as const,
              text: content,
              fontFamily: '"Inter", sans-serif',
              fontWeight: '700',
              fontSize: 72,
              color: '#ffffff',
              background: 'rgba(0,0,0,0.35)',
              align: 'center' as const,
              position: { x: 300, y: 720 },
              size: { width: 480, height: 480 },
              rotation: 0,
              scale: { x: 1, y: 1 },
              opacity: 1,
              zIndex: 0,
            }] : [],
          },
        })
      }
    }

    if (slidesToRender.length === 0) {
      await updateRenderJobStatus(jobId, 'failed', {
        errorMessage: 'No slides to render',
      })
      return NextResponse.json(
        { error: 'No slides to render' },
        { status: 400 }
      )
    }

    // Render all slides in parallel with concurrency limit
    const slideBuffers: Array<{ slideNumber: number; imageBuffer: Buffer }> = []
    
    // Process in batches of 5 to avoid overwhelming the browser/server
    const CONCURRENCY = 5
    for (let i = 0; i < slidesToRender.length; i += CONCURRENCY) {
      const batch = slidesToRender.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map(async (slide) => {
        try {
          const result = await renderSlide({ layout: slide.layout })
          if (result.success && result.imageBuffer) {
            return {
              slideNumber: slide.slideNumber,
              imageBuffer: result.imageBuffer,
            }
          } else {
            console.error(`Failed to render slide ${slide.slideNumber}:`, result.error)
            return null
          }
        } catch (e) {
          console.error(`Exception rendering slide ${slide.slideNumber}:`, e)
          return null
        }
      }))
      
      // Filter out nulls and add to buffers
      results.forEach(r => {
        if (r) slideBuffers.push(r)
      })
    }
    
    // Sort buffers by slide number to ensure correct video order
    slideBuffers.sort((a, b) => a.slideNumber - b.slideNumber)

    // Close browser to free resources
    await closeBrowser()

    if (slideBuffers.length === 0) {
      await updateRenderJobStatus(jobId, 'failed', {
        errorMessage: 'No slides were rendered successfully',
      })
      return NextResponse.json(
        {
          success: false,
          error: 'No slides were rendered successfully',
        },
        { status: 500 }
      )
    }

    // Update status to encoding
    await updateRenderJobStatus(jobId, 'encoding')

    // Compile video from rendered slides
    const videoResult = await compileVideo({
      slideImages: slideBuffers,
      outputFilename: `${job.persona_type}-${job.country}.mp4`,
      slideDuration: 4, // 4 seconds per slide
      ideaId: job.idea_id,
      persona: job.persona_type,
      country: job.country,
    })

    if (!videoResult.success) {
      await updateRenderJobStatus(jobId, 'failed', {
        errorMessage: videoResult.error || 'Video compilation failed',
      })
      return NextResponse.json(
        {
          success: false,
          error: videoResult.error || 'Video compilation failed',
        },
        { status: 500 }
      )
    }

    // Update status to complete with video URL
    await updateRenderJobStatus(jobId, 'complete', {
      outputUrl: videoResult.publicUrl || null,
    })

    return NextResponse.json({
      success: true,
      jobId,
      slidesRendered: slideBuffers.length,
      videoUrl: videoResult.publicUrl,
      storagePath: videoResult.storagePath,
    })
  } catch (error: any) {
    console.error('[render-process] Error:', error)

    // Update job status to failed if we have jobId
    if (jobId) {
      try {
        await updateRenderJobStatus(jobId, 'failed', {
          errorMessage: error.message || 'Unknown error',
        })
      } catch {
        // Ignore status update errors
      }
    }

    return NextResponse.json(
      {
        error: error.message || 'Render failed',
      },
      { status: 500 }
    )
  }
}
