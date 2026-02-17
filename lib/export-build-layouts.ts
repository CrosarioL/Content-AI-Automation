/**
 * Builds export layout configs for each slide (shared by server and client prepare API).
 * Export always includes ALL slides from the idea – post.choices only provides image/variant picks.
 */
import type { SlideLayoutConfig } from '@/types'

// Matches the shape stored on PostChoices.slides. We keep runtime values 1 or 2,
// but allow plain number here so TS doesn't complain when reading from DB.
export interface SlideChoice {
  slide_number: number
  image_id?: string
  text_variant_index: number
}

/** Build effective slide choices: all slides from persona, with stored choices when available */
export function getEffectiveSlideChoices(
  personaSlides: Array<{ slide_number: number; text_pools: any[]; image_pools?: any[] }>,
  postChoices: SlideChoice[] | undefined,
  country: string
): SlideChoice[] {
  const choiceMap = new Map<number, SlideChoice>()
  for (const c of postChoices || []) {
    choiceMap.set(c.slide_number, c)
  }

  const result: SlideChoice[] = []
  for (const slide of personaSlides) {
    const existing = choiceMap.get(slide.slide_number)
    if (existing) {
      result.push(existing)
    } else {
      const textPools = slide.text_pools.filter((t) => t.country === country)
      const variantIndex = textPools.length > 0
        ? (textPools[0].variant_index as 1 | 2) || 1
        : 1
      const imagePool = slide.image_pools || []
      const imageId = imagePool.length > 0
        ? imagePool[Math.floor(Math.random() * imagePool.length)].id
        : undefined
      result.push({
        slide_number: slide.slide_number,
        image_id: imageId,
        text_variant_index: variantIndex,
      })
    }
  }
  return result.sort((a, b) => a.slide_number - b.slide_number)
}

export interface ExportSlideItem {
  slideNumber: number
  layoutConfig: SlideLayoutConfig
}

export interface ExportPostItem {
  postId: string
  country: string
  postIndex: number
  personaType: string
  slides: ExportSlideItem[]
}

export interface ExportPreparePayload {
  ideaTitle: string
  folderId: string
  posts: ExportPostItem[]
}

const EXPORT_OVERLAY_OPACITY = 0.03
const EXPORT_OVERLAY_COLORS = ['#ff0000', '#00ff00', '#0000ff']

function getExportOverlay(slideNumber: number): { color: string; opacity: number } {
  const index = Math.abs((slideNumber ?? 1) - 1) % EXPORT_OVERLAY_COLORS.length
  return {
    color: EXPORT_OVERLAY_COLORS[index],
    opacity: EXPORT_OVERLAY_OPACITY,
  }
}

export interface ExportSlideBuildResult {
  layoutConfig: SlideLayoutConfig
  imageUrl?: string
  textContent: string
}

export function buildLayoutForSlideWithMeta(
  slide: { slide_number: number; text_pools: any[]; image_pools?: any[] },
  slideChoice: { slide_number: number; text_variant_index: number; image_id?: string },
  postCountry: string,
  getImageUrl: (img: any) => string | undefined
): ExportSlideBuildResult | null {
  let textPool = slide.text_pools.find(
    (t) => t.country === postCountry && t.variant_index === slideChoice.text_variant_index
  )
  if (!textPool) {
    textPool = slide.text_pools.find((t) => t.country === postCountry)
  }
  if (!textPool && (postCountry === 'ksa' || postCountry === 'my')) {
    const sourceVariantIndex = postCountry === 'ksa' ? 1 : 2
    textPool =
      slide.text_pools.find((t) => t.country === 'us' && t.variant_index === sourceVariantIndex) ??
      slide.text_pools.find((t) => t.country === 'us' && t.variant_index === 1) ??
      slide.text_pools.find((t) => t.country === 'uk' && t.variant_index === sourceVariantIndex) ??
      slide.text_pools.find((t) => t.country === 'uk' && t.variant_index === 1) ??
      undefined
  }
  if (!textPool && slide.text_pools.length > 0) {
    textPool = slide.text_pools[0]
  }

  let imageUrl: string | undefined
  let selectedImage: any
  if (slideChoice.image_id && slide.image_pools?.length) {
    selectedImage = slide.image_pools.find((img: any) => img.id === slideChoice.image_id)
  }
  if (!selectedImage && slide.image_pools?.length) {
    selectedImage = slide.image_pools[Math.floor(Math.random() * slide.image_pools.length)]
  }
  if (selectedImage) {
    imageUrl = getImageUrl(selectedImage)
  }

  let layoutConfig: SlideLayoutConfig
  if (textPool?.layout_config) {
    const savedLayout = textPool.layout_config as SlideLayoutConfig
    layoutConfig = {
      ...savedLayout,
      background: {
        color: savedLayout.background?.color || '#0F1A2C',
        image: imageUrl || savedLayout.background?.image || undefined,
      },
      layers: (savedLayout.layers && savedLayout.layers.length > 0)
        ? savedLayout.layers.map((layer) => ({
            ...layer,
            text: layer.text || textPool!.content || '',
          }))
        : textPool.content
          ? [{
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
            }]
          : [],
    }
  } else {
    layoutConfig = {
      version: 1,
      canvas: { width: 1080, height: 1920 },
      safeZone: { top: 180, bottom: 220 },
      background: { color: '#0F1A2C', image: imageUrl },
      layers: textPool?.content
        ? [{
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
            position: { x: 540, y: 960 },
            size: { width: 700, height: 200 },
            rotation: 0,
            scale: { x: 1, y: 1 },
            opacity: 1,
            zIndex: 0,
          }]
        : [],
    }
  }

  layoutConfig.metadata = {
    ...(layoutConfig.metadata || {}),
    exportOverlay: getExportOverlay(slide.slide_number),
  }

  return {
    layoutConfig,
    imageUrl,
    textContent: textPool?.content || '',
  }
}

export function buildLayoutForSlide(
  slide: { slide_number: number; text_pools: any[]; image_pools?: any[] },
  slideChoice: { slide_number: number; text_variant_index: number; image_id?: string },
  postCountry: string,
  getImageUrl: (img: any) => string | undefined
): SlideLayoutConfig | null {
  const result = buildLayoutForSlideWithMeta(slide, slideChoice, postCountry, getImageUrl)
  return result ? result.layoutConfig : null
}
