/**
 * Shared layer style computation for slide rendering.
 * Used by: (1) backend renderer (HTML string for Puppeteer), (2) front-end editor (React inline styles).
 * Single source of truth so editor and export match exactly (WYSIWYG).
 */
import type { CSSProperties } from 'react'
import type { SlideTextLayer } from '@/types'

function escapeFontFamily(fontFamily: string): string {
  return fontFamily.replace(/"/g, "'")
}

export interface LayerRenderData {
  displayText: string
  hasBackground: boolean
  wrapWidth: number
  /** Full container style (for backend HTML and static preview). */
  containerStyle: CSSProperties
  /** Position only (for editor drag wrapper). */
  containerPositionStyle: CSSProperties
  /** Transform only (for editor inner content when wrapper handles position). */
  containerTransformStyle: CSSProperties
  wrapperStyle: CSSProperties | null
  textStyle: CSSProperties
}

export function getLayerRenderData(layer: SlideTextLayer): LayerRenderData {
  const scaleX = layer.scale?.x ?? 1
  const scaleY = layer.scale?.y ?? 1
  const hasBackground = !!(layer.background && layer.background !== 'transparent')
  const centerX = layer.position.x
  const centerY = layer.position.y
  const displayText = (layer as { wrappedText?: string }).wrappedText ?? layer.text ?? ''
  const hasExplicitLineBreaks = displayText.includes('\n')
  // Minimum 800px so text never wraps to single chars (TikTok-style ~20+ chars/line)
  const wrapWidth = Math.max(layer.size?.width ?? 1000, 800)

  const textStyle: CSSProperties = {
    fontFamily: escapeFontFamily(layer.fontFamily || 'Inter, sans-serif'),
    fontWeight: layer.fontWeight || '500',
    fontSize: layer.fontSize || 60,
    color: layer.color || '#ffffff',
    textAlign: layer.align || 'center',
    whiteSpace: hasExplicitLineBreaks ? 'pre-wrap' : 'normal',
    lineHeight: layer.lineHeight ?? 1.2,
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  }
  if (layer.strokeColor && layer.strokeWidth && layer.strokeColor !== 'transparent' && layer.strokeWidth > 0) {
    textStyle.WebkitTextStroke = `${layer.strokeWidth}px ${layer.strokeColor}`
    textStyle.paintOrder = 'stroke fill'
  }
  if (layer.shadowColor && layer.shadowBlur && layer.shadowBlur > 0) {
    const shadowX = layer.shadowOffsetX ?? 2
    const shadowY = layer.shadowOffsetY ?? 2
    textStyle.textShadow = `${shadowX}px ${shadowY}px ${layer.shadowBlur}px ${layer.shadowColor}`
  }
  if (layer.letterSpacing !== undefined && layer.letterSpacing !== 0) {
    textStyle.letterSpacing = `${layer.letterSpacing}px`
  }

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: centerX,
    top: centerY,
    transformOrigin: 'center center',
    transform: `translate(-50%, -50%) rotate(${layer.rotation ?? 0}deg) scale(${scaleX}, ${scaleY})`,
    opacity: layer.opacity ?? 1,
    textAlign: layer.align || 'center',
  }
  const containerPositionStyle: CSSProperties = {
    position: 'absolute',
    left: centerX,
    top: centerY,
  }
  const containerTransformStyle: CSSProperties = {
    transformOrigin: 'center center',
    transform: `translate(-50%, -50%) rotate(${layer.rotation ?? 0}deg) scale(${scaleX}, ${scaleY})`,
    opacity: layer.opacity ?? 1,
    textAlign: layer.align || 'center',
  }

  // Reference style for background box; preview/renderer use two-span approach (bg behind, text on top)
  const wrapperStyle: CSSProperties | null = hasBackground
    ? {
        display: 'inline-block',
        maxWidth: wrapWidth,
        background: layer.background,
        padding: '8px 18px',
        borderRadius: 8,
        textAlign: layer.align || 'center',
        boxSizing: 'border-box',
      }
    : null

  return {
    displayText,
    hasBackground,
    wrapWidth,
    containerStyle,
    containerPositionStyle,
    containerTransformStyle,
    wrapperStyle,
    textStyle,
  }
}

/**
 * Break text into lines that fit wrapWidth (no DOM/canvas). Word-boundary only, never mid-word.
 * Used by backend renderer for per-line pills. Uses approximate width ~0.55 * fontSize per char.
 */
export function getWrappedLinesForExport(
  text: string,
  wrapWidth: number,
  fontSize: number
): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')
  const approxCharWidth = fontSize * 0.55
  // Minimum ~20 chars per line (TikTok-style); avoid tiny wrap from old layers
  const effectiveWidth = Math.max(wrapWidth - 36, 900)
  const maxCharsPerLine = Math.max(20, Math.floor(effectiveWidth / approxCharWidth))
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    let currentLine = words[0]
    for (let i = 1; i < words.length; i++) {
      const candidate = currentLine + ' ' + words[i]
      if (candidate.length > maxCharsPerLine && currentLine) {
        lines.push(currentLine)
        currentLine = words[i]
      } else {
        currentLine = candidate
      }
    }
    if (currentLine) lines.push(currentLine)
  }
  return lines.length ? lines : [text || ' ']
}

/** Convert CSSProperties to a string for inline style="..." (backend HTML). */
export function cssPropertiesToString(style: CSSProperties): string {
  const pxKeys = new Set(['left', 'top', 'font-size', 'letter-spacing', 'max-width', 'width', 'border-radius'])
  const parts: string[] = []
  for (const [key, value] of Object.entries(style)) {
    if (value == null || value === '') continue
    const k = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')
    let v = String(value)
    if (typeof value === 'number' && pxKeys.has(k)) v = value + 'px'
    parts.push(`${k}: ${v}`)
  }
  return parts.join('; ')
}
