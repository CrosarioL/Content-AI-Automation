/**
 * Per-line text width measurement for TikTok-style backgrounds.
 * Works in browser (canvas) and Node.js (node-canvas).
 * Returns each line's text and its measured width so we can draw per-line background rects.
 */

export interface LineMetric {
  text: string
  width: number
  y: number
}

export interface MeasureOptions {
  text: string
  wrapWidth: number
  fontSize: number
  fontFamily: string
  fontWeight: string
  letterSpacing?: number
  lineHeight?: number
}

/** True if text contains predominantly Arabic. Currently unused but kept for potential future tweaks. */
export function hasArabicScript(text: string): boolean {
  const arabicCount = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length
  return arabicCount >= 2 || (text.length > 0 && arabicCount / text.length > 0.2)
}

/** Wrap width to use for layout/rendering. We now keep Arabic the same width as other languages. */
export function getEffectiveWrapWidth(text: string, wrapWidth: number): number {
  return wrapWidth
}

/**
 * Break text into lines that fit wrapWidth and measure each line's width.
 * Uses word-boundary wrapping. Returns metrics for each line.
 */
export function measureTextLines(
  ctx: CanvasRenderingContext2D,
  opts: MeasureOptions
): LineMetric[] {
  const {
    text,
    wrapWidth,
    fontSize,
    fontFamily,
    fontWeight,
    letterSpacing = 0,
    lineHeight = 1.2,
  } = opts

  const effectiveWrapWidth = wrapWidth

  const font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.font = font
  // letterSpacing not in standard Canvas 2D API; ignore for measurement

  const lines: LineMetric[] = []
  const paragraphs = text.split('\n')
  let y = 0
  const lineHeightPx = fontSize * lineHeight

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    let currentLine = words[0]
    for (let i = 1; i < words.length; i++) {
      const candidate = currentLine + ' ' + words[i]
      const w = ctx.measureText(candidate).width
      if (w > effectiveWrapWidth) {
        const lineWidth = ctx.measureText(currentLine).width
        lines.push({ text: currentLine, width: lineWidth, y })
        y += lineHeightPx
        currentLine = words[i]
      } else {
        currentLine = candidate
      }
    }
    if (currentLine) {
      const lineWidth = ctx.measureText(currentLine).width
      lines.push({ text: currentLine, width: lineWidth, y })
      y += lineHeightPx
    }
  }

  const fallbackWidth = ctx.measureText(text || ' ').width
  return lines.length ? lines : [{ text: text || ' ', width: fallbackWidth, y: 0 }]
}
