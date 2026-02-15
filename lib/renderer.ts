/**
 * Server-side slide renderer using Konva + node-canvas.
 */
import 'konva/canvas-backend'
import Konva from 'konva'
import { registerFont, loadImage, createCanvas } from 'canvas'
import path from 'path'
import fs from 'fs'
import { supabaseServer } from './supabase'
import type { SlideLayoutConfig, SlideTextLayer } from '@/types'
import { measureTextLines, hasArabicScript, isArrowOnlyLine, getTrailingArrowParts } from './text-line-metrics'

const DEFAULT_WIDTH = 1080
const DEFAULT_HEIGHT = 1920

// ── Font registration (run once) ──────────────────────────────────────────────
// node-canvas has broken variable font + weight support. Use static fonts only,
// each weight as a separate family name (the only reliable workaround).

let fontsRegistered = false

const LAYOUT_FONT_FAMILY = 'TikTok Sans'

// Map layout fontWeight to unique family name (node-canvas ignores weight when same family)
const WEIGHT_TO_STATIC_FAMILY: Record<string, string> = {
  '300': 'TikTokSansExport-Light', light: 'TikTokSansExport-Light',
  normal: 'TikTokSansExport-Regular', '400': 'TikTokSansExport-Regular',
  '500': 'TikTokSansExport-Medium', '600': 'TikTokSansExport-SemiBold',
  bold: 'TikTokSansExport-Bold', '700': 'TikTokSansExport-Bold',
  '800': 'TikTokSansExport-ExtraBold', '900': 'TikTokSansExport-Black', black: 'TikTokSansExport-Black',
}

function registerFontsOnce() {
  if (fontsRegistered) return
  fontsRegistered = true

  const fontsDir = path.join(process.cwd(), 'Tiktok Sans', 'static')
  if (!fs.existsSync(fontsDir)) {
    console.warn('[renderer] TikTok Sans static fonts not found')
    return
  }

  // Use base fonts (no 24pt) - match variable font at typical sizes; 24pt is tuned for small text
  const fontFiles: [string, string][] = [
    ['TikTokSans-Light.ttf', 'TikTokSansExport-Light'],
    ['TikTokSans-Regular.ttf', 'TikTokSansExport-Regular'],
    ['TikTokSans-Medium.ttf', 'TikTokSansExport-Medium'],
    ['TikTokSans-SemiBold.ttf', 'TikTokSansExport-SemiBold'],
    ['TikTokSans-Bold.ttf', 'TikTokSansExport-Bold'],
    ['TikTokSans-ExtraBold.ttf', 'TikTokSansExport-ExtraBold'],
    ['TikTokSans-Black.ttf', 'TikTokSansExport-Black'],
  ]

  for (const [file, family] of fontFiles) {
    const fontPath = path.join(fontsDir, file)
    if (fs.existsSync(fontPath)) {
      try {
        registerFont(fontPath, { family })
      } catch (e) {
        console.warn('[renderer] Failed to register', file, e)
      }
    }
  }
  console.log('[renderer] Static TikTok Sans fonts registered (node-canvas compatible)')
}

function resolveExportFontFamily(rawFamily: string, fontWeight: string): string {
  const base = rawFamily?.replace(/['"]/g, '').split(',')[0].trim()
  const isTikTok = /TikTok Sans/i.test(base || '')
  if (!isTikTok) return base || 'TikTokSansExport-Medium'
  return WEIGHT_TO_STATIC_FAMILY[fontWeight] || WEIGHT_TO_STATIC_FAMILY['500'] || 'TikTokSansExport-Medium'
}

// ── Image loading helper ──────────────────────────────────────────────────────

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch {
    return null
  }
}

// ── Build a Konva Stage exactly like SlideExportCanvas ────────────────────────

async function buildKonvaStage(layout: SlideLayoutConfig): Promise<Konva.Stage> {
  const bgColor = layout.background?.color || '#0F1A2C'
  const layers = [...(layout.layers || [])].sort((a, b) => a.zIndex - b.zIndex)
  const CANVAS_WIDTH = layout.canvas?.width ?? DEFAULT_WIDTH
  const CANVAS_HEIGHT = layout.canvas?.height ?? DEFAULT_HEIGHT

  // Create stage (no container needed on Node.js)
  const stage = new Konva.Stage({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  })

  // Background layer
  const bgLayer = new Konva.Layer()
  bgLayer.add(new Konva.Rect({
    x: 0, y: 0,
    width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
    fill: bgColor,
  }))

  // Background image — load via node-canvas loadImage, then pass to Konva.Image
  const bgImageUrl = layout.background?.image
  if (bgImageUrl) {
    try {
      const imgBuf = await fetchImageBuffer(bgImageUrl)
      if (imgBuf) {
        const canvasImg = await loadImage(imgBuf)

        // Preserve aspect ratio: cover canvas and crop overflow (no stretching)
        const imgW = (canvasImg as any).width || CANVAS_WIDTH
        const imgH = (canvasImg as any).height || CANVAS_HEIGHT
        const scaleBase = Math.max(CANVAS_WIDTH / imgW, CANVAS_HEIGHT / imgH)
        const renderWidth = imgW * scaleBase
        const renderHeight = imgH * scaleBase
        const x = (CANVAS_WIDTH - renderWidth) / 2
        const y = (CANVAS_HEIGHT - renderHeight) / 2

        const img = new Konva.Image({
          x,
          y,
          width: renderWidth,
          height: renderHeight,
          image: canvasImg as any,
        })
        bgLayer.add(img)
      }
    } catch (e) {
      console.warn('[renderer] Failed to load background image:', bgImageUrl)
    }
  }

  stage.add(bgLayer)

  // Create a canvas for text measurement (node-canvas)
  const measureCanvas = createCanvas(1, 1)
  const measureCtx = measureCanvas.getContext('2d') as unknown as CanvasRenderingContext2D

  // Text layers
  const textLayer = new Konva.Layer()

  for (const layer of layers) {
    const text = (layer as { wrappedText?: string }).wrappedText ?? layer.text ?? ''
    const lines = text.split('\n')
    const hasArrowLastLine = lines.length >= 2 && isArrowOnlyLine(lines[lines.length - 1])
    const trailing = getTrailingArrowParts(text)
    const mainText = hasArrowLastLine ? lines.slice(0, -1).join('\n') : (trailing?.mainText ?? text)
    const arrowLine = hasArrowLastLine ? lines[lines.length - 1] : (trailing?.arrowLine ?? null)
    const fontSize = layer.fontSize ?? 60
    const rawFamily = layer.fontFamily?.replace(/['"]/g, '') || 'TikTok Sans'
    const fontWeight = layer.fontWeight || '500'
    const fontFamily = resolveExportFontFamily(rawFamily, fontWeight)
    const lineHeight = layer.lineHeight ?? 1.2
    const lineHeightPx = fontSize * lineHeight
    const isRtl = hasArabicScript(text)
    const align = isRtl ? 'right' : (layer.align || 'center')
    const blockWidth = layer.size?.width ?? Math.max(layer.size?.width ?? 1000, 800)
    const wrapWidth = Math.max(blockWidth, 800)
    const hasBackground = !!(layer.background && layer.background !== 'transparent')
    const pad = 18
    const textTopOffset = fontSize * 0.05

    const group = new Konva.Group({
      x: layer.position.x,
      y: layer.position.y,
      scaleX: layer.scale?.x ?? 1,
      scaleY: layer.scale?.y ?? 1,
      rotation: layer.rotation ?? 0,
      opacity: layer.opacity ?? 1,
    })

    const lineMetricsMain = measureTextLines(measureCtx, {
      text: mainText,
      wrapWidth,
      fontSize,
      fontFamily,
      fontWeight,
      lineHeight,
    })
    const arrowY = arrowLine != null ? lineMetricsMain.length * lineHeightPx : 0

    // Per-line background rects (TikTok-style pills) — use mainText so we don't pill the arrow line
    if (hasBackground) {
      for (const metric of lineMetricsMain) {
        const rectWidth = metric.width + pad * 2
        let rectX: number
        if (align === 'center') rectX = -rectWidth / 2
        else if (align === 'right') rectX = blockWidth / 2 - rectWidth
        else rectX = -blockWidth / 2 - pad

        group.add(new Konva.Rect({
          x: rectX,
          y: -textTopOffset + metric.y - pad,
          width: rectWidth,
          height: lineHeightPx + pad * 2,
          fill: layer.background!,
          cornerRadius: 8,
        }))
      }
    }

    // Static fonts: weight is in family name, use fontStyle 'normal'
    group.add(new Konva.Text({
      text: mainText,
      x: -blockWidth / 2,
      y: -textTopOffset,
      width: blockWidth,
      fontSize,
      fontFamily,
      fontStyle: 'normal',
      fill: layer.color || '#ffffff',
      align,
      direction: isRtl ? 'rtl' : 'ltr',
      wrap: 'word',
      stroke: layer.strokeColor || 'transparent',
      strokeWidth: layer.strokeWidth ?? 0,
      fillAfterStrokeEnabled: true,
      lineHeight,
      letterSpacing: layer.letterSpacing ?? 0,
    }))

    if (arrowLine != null) {
      group.add(new Konva.Text({
        text: arrowLine,
        x: -blockWidth / 2,
        y: -textTopOffset + arrowY,
        width: blockWidth,
        fontSize,
        fontFamily,
        fontStyle: 'normal',
        fill: layer.color || '#ffffff',
        align: 'center',
        direction: 'ltr',
        wrap: 'word',
        stroke: layer.strokeColor || 'transparent',
        strokeWidth: layer.strokeWidth ?? 0,
        fillAfterStrokeEnabled: true,
        lineHeight,
        letterSpacing: layer.letterSpacing ?? 0,
      }))
    }

    textLayer.add(group)
  }

  stage.add(textLayer)
  return stage
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RenderSlideOptions {
  layout: SlideLayoutConfig
  outputPath?: string
}

export interface RenderSlideResult {
  success: boolean
  imageBuffer?: Buffer
  storagePath?: string
  publicUrl?: string
  error?: string
}

/**
 * Render a slide to a JPEG buffer using Konva + node-canvas.
 */
export async function renderSlide(options: RenderSlideOptions): Promise<RenderSlideResult> {
  const { layout, outputPath } = options

  try {
    registerFontsOnce()

    const stage = await buildKonvaStage(layout)

    const dataUrl = stage.toDataURL({ mimeType: 'image/jpeg', quality: 0.85 })
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
    const imageBuffer = Buffer.from(base64, 'base64')

    stage.destroy()

    const result: RenderSlideResult = {
      success: true,
      imageBuffer,
    }

    if (outputPath && imageBuffer) {
      const bucket = process.env.SLIDE_ASSETS_BUCKET || 'slide-assets'
      const { data, error } = await supabaseServer.storage
        .from(bucket)
        .upload(outputPath, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (error) {
        console.error('Failed to upload slide image:', error)
        result.error = `Upload failed: ${error.message}`
      } else {
        result.storagePath = data.path
        const { data: urlData } = supabaseServer.storage
          .from(bucket)
          .getPublicUrl(outputPath)
        result.publicUrl = urlData.publicUrl
      }
    }

    return result
  } catch (err: any) {
    console.error('Slide render failed:', err)
    return {
      success: false,
      error: err.message || 'Render failed',
    }
  }
}

export async function closeBrowser(): Promise<void> {
  // No-op: node-canvas doesn't need cleanup
}

// ── Batch rendering ───────────────────────────────────────────────────────────

export interface RenderJobSlidesOptions {
  jobId: string
  ideaId: string
  persona: string
  country: string
  slides: Array<{
    slideNumber: number
    layout: SlideLayoutConfig
  }>
}

export interface RenderJobSlidesResult {
  success: boolean
  renderedSlides: Array<{
    slideNumber: number
    storagePath: string
    publicUrl: string
  }>
  errors: string[]
}

export async function renderJobSlides(options: RenderJobSlidesOptions): Promise<RenderJobSlidesResult> {
  const { jobId, ideaId, persona, country, slides } = options
  const renderedSlides: RenderJobSlidesResult['renderedSlides'] = []
  const errors: string[] = []

  for (const slide of slides) {
    const outputPath = `renders/${ideaId}/${persona}-${country}/slide-${slide.slideNumber}.png`
    const result = await renderSlide({ layout: slide.layout, outputPath })

    if (result.success && result.storagePath && result.publicUrl) {
      renderedSlides.push({
        slideNumber: slide.slideNumber,
        storagePath: result.storagePath,
        publicUrl: result.publicUrl,
      })
    } else {
      errors.push(`Slide ${slide.slideNumber}: ${result.error || 'Unknown error'}`)
    }
  }

  return {
    success: errors.length === 0,
    renderedSlides,
    errors,
  }
}
