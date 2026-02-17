'use client'

/**
 * Renders a single slide with Konva at full resolution (1080x1920).
 * Same visual output as the editor – used for export so "what you see is what you get".
 * Uses per-line background rects (TikTok-style) instead of one full-width box.
 */
import { useRef, useEffect, useState, useMemo } from 'react'
import { Stage, Layer, Rect, Text as KonvaText, Group, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { SlideLayoutConfig, SlideTextLayer } from '@/types'
import { measureTextLines, getEffectiveWrapWidth, hasArabicScript, isArrowOnlyLine, getTrailingArrowParts } from '@/lib/text-line-metrics'

const DEFAULT_WIDTH = 1080
const DEFAULT_HEIGHT = 1920

function useKonvaImage(url: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) {
      setImage(null)
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = url
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [url])
  return image
}

function getBackgroundImageLayout(
  image: HTMLImageElement | null,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!image) return null

  const imgW = image.width || canvasWidth
  const imgH = image.height || canvasHeight

  // "cover" behavior: fill canvas without distortion, crop overflow
  const scaleBase = Math.max(canvasWidth / imgW, canvasHeight / imgH)
  const finalScale = scaleBase

  const renderWidth = imgW * finalScale
  const renderHeight = imgH * finalScale

  const x = (canvasWidth - renderWidth) / 2
  const y = (canvasHeight - renderHeight) / 2

  return { x, y, width: renderWidth, height: renderHeight }
}

export interface SlideExportCanvasProps {
  layout: SlideLayoutConfig
  backgroundImageUrl?: string
  stageRef?: React.RefObject<Konva.Stage | null>
  /** Called when the slide is ready to export (e.g. background image loaded) */
  onReady?: () => void
}

export function SlideExportCanvas({
  layout,
  backgroundImageUrl,
  stageRef: externalStageRef,
  onReady,
}: SlideExportCanvasProps) {
  const internalStageRef = useRef<Konva.Stage>(null)
  const stageRef = externalStageRef ?? internalStageRef
  const backgroundImage = useKonvaImage(backgroundImageUrl)
  const CANVAS_WIDTH = layout.canvas?.width ?? DEFAULT_WIDTH
  const CANVAS_HEIGHT = layout.canvas?.height ?? DEFAULT_HEIGHT
  const [readyFired, setReadyFired] = useState(false)

  const bgColor = layout.background?.color || '#0F1A2C'
  const exportOverlay = layout.metadata?.exportOverlay as { color?: string; opacity?: number } | undefined
  const overlayOpacity = typeof exportOverlay?.opacity === 'number'
    ? Math.max(0, Math.min(exportOverlay.opacity, 1))
    : 0
  const layers = [...(layout.layers || [])].sort((a, b) => a.zIndex - b.zIndex)

  const bgLayout = useMemo(
    () => getBackgroundImageLayout(backgroundImage, CANVAS_WIDTH, CANVAS_HEIGHT),
    [backgroundImage, CANVAS_WIDTH, CANVAS_HEIGHT]
  )

  const measureCtx = useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    return canvas.getContext('2d')
  }, [])

  const lineMetricsByLayer = useMemo(() => {
    const map = new Map<string, Array<{ text: string; width: number; y: number }>>()
    if (!measureCtx) return map
    for (const layer of layers) {
      const hasBackground = layer.background && layer.background !== 'transparent'
      const text = (layer as { wrappedText?: string }).wrappedText ?? layer.text ?? ''
      const wrapWidth = Math.max(layer.size?.width ?? 1000, 800)
      if (!hasBackground) continue
      const isRtl = hasArabicScript(text)
      const lines = text.split('\n')
      const hasArrowLastLine = lines.length >= 2 && isArrowOnlyLine(lines[lines.length - 1])
      const trailing = getTrailingArrowParts(text)
      const useArrowSplit = isRtl && (hasArrowLastLine || !!trailing)
      const textForMetrics = useArrowSplit ? (hasArrowLastLine ? lines.slice(0, -1).join('\n') : trailing!.mainText) : text
      const metrics = measureTextLines(measureCtx, {
        text: textForMetrics,
        wrapWidth,
        fontSize: layer.fontSize ?? 60,
        fontFamily: layer.fontFamily?.replace(/['"]/g, '') || 'Inter',
        fontWeight: layer.fontWeight || '500',
        lineHeight: layer.lineHeight ?? 1.2,
      })
      map.set(layer.id, metrics)
    }
    return map
  }, [measureCtx, layers])

  type ArrowInfo = { mainText: string; arrowLine: string; arrowY: number }
  const arrowInfoByLayer = useMemo(() => {
    const map = new Map<string, ArrowInfo>()
    if (!measureCtx) return map
    for (const layer of layers) {
      const text = (layer as { wrappedText?: string }).wrappedText ?? layer.text ?? ''
      if (!hasArabicScript(text)) continue
      const wrapWidth = Math.max(layer.size?.width ?? 1000, 800)
      const fontSize = layer.fontSize ?? 60
      const lh = layer.lineHeight ?? 1.2
      const lines = text.split('\n')
      const hasArrowLastLine = lines.length >= 2 && isArrowOnlyLine(lines[lines.length - 1])
      const trailing = getTrailingArrowParts(text)
      if (hasArrowLastLine) {
        const mainText = lines.slice(0, -1).join('\n')
        const arrowLine = lines[lines.length - 1]
        const metrics = measureTextLines(measureCtx, { text: mainText, wrapWidth, fontSize, fontFamily: layer.fontFamily?.replace(/['"]/g, '') || 'Inter', fontWeight: layer.fontWeight || '500', lineHeight: lh })
        map.set(layer.id, { mainText, arrowLine, arrowY: metrics.length * fontSize * lh })
      } else if (trailing) {
        const metrics = measureTextLines(measureCtx, { text: trailing.mainText, wrapWidth, fontSize, fontFamily: layer.fontFamily?.replace(/['"]/g, '') || 'Inter', fontWeight: layer.fontWeight || '500', lineHeight: lh })
        map.set(layer.id, { mainText: trailing.mainText, arrowLine: trailing.arrowLine, arrowY: metrics.length * fontSize * lh })
      }
    }
    return map
  }, [measureCtx, layers])

  useEffect(() => {
    if (readyFired || !onReady) return
    if (!backgroundImageUrl || backgroundImage) {
      setReadyFired(true)
      onReady()
    }
  }, [backgroundImageUrl, backgroundImage, onReady, readyFired])

  return (
    <Stage
      ref={stageRef as React.RefObject<Konva.Stage>}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
    >
      <Layer>
        <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={bgColor} />
        {backgroundImageUrl && backgroundImage && bgLayout && (
          <KonvaImage
            image={backgroundImage}
            x={bgLayout.x}
            y={bgLayout.y}
            width={bgLayout.width}
            height={bgLayout.height}
            listening={false}
          />
        )}
        {exportOverlay?.color && overlayOpacity > 0 && (
          <Rect
            x={0}
            y={0}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            fill={exportOverlay.color}
            opacity={overlayOpacity}
            listening={false}
          />
        )}
      </Layer>
      <Layer>
        {layers.map((layer: SlideTextLayer) => {
          const scaleX = layer.scale?.x ?? 1
          const scaleY = layer.scale?.y ?? 1
          const hasBackground = layer.background && layer.background !== 'transparent'
          const text = (layer as { wrappedText?: string }).wrappedText ?? layer.text ?? ''
          const pad = 18
          const fontSize = layer.fontSize ?? 60
          const wrapWidth = Math.max(layer.size?.width ?? 1000, 800)
          const lineHeight = layer.lineHeight ?? 1.2
          const lineHeightPx = fontSize * lineHeight
          const textTopOffset = fontSize * 0.05
          const arrowInfo = arrowInfoByLayer.get(layer.id)
          const mainText = arrowInfo ? arrowInfo.mainText : text
          const arrowLine = arrowInfo?.arrowLine ?? null
          const arrowY = arrowInfo?.arrowY ?? 0
          const lineMetrics = hasBackground ? (lineMetricsByLayer.get(layer.id) ?? []) : []
          const isRtl = hasArabicScript(text)
          const align = isRtl ? 'right' : (layer.align || 'center')
          const blockWidth = layer.size?.width ?? wrapWidth
          const effectiveBlockWidth = getEffectiveWrapWidth(text, blockWidth)

          return (
            <Group
              key={layer.id}
              x={layer.position.x}
              y={layer.position.y}
              scaleX={scaleX}
              scaleY={scaleY}
              rotation={layer.rotation ?? 0}
              opacity={layer.opacity ?? 1}
              listening={false}
            >
              {hasBackground && (lineMetrics.length > 0 ? lineMetrics.map((metric, i) => {
                const rectWidth = metric.width + pad * 2
                let rectX: number
                if (align === 'center') {
                  rectX = -rectWidth / 2
                } else if (align === 'right') {
                  rectX = effectiveBlockWidth / 2 - rectWidth
                } else {
                  rectX = -effectiveBlockWidth / 2 - pad
                }
                return (
                  <Rect
                    key={i}
                    x={rectX}
                    y={-textTopOffset + metric.y - pad}
                    width={rectWidth}
                    height={lineHeightPx + pad * 2}
                    fill={layer.background}
                    cornerRadius={8}
                    listening={false}
                  />
                )
              }) : (
                <Rect
                  x={-effectiveBlockWidth / 2 - pad}
                  y={-textTopOffset - pad}
                  width={effectiveBlockWidth + pad * 2}
                  height={(layer.size?.height ?? fontSize * 3) + pad * 2}
                  fill={layer.background}
                  cornerRadius={10}
                  listening={false}
                />
              ))}
              <KonvaText
                text={mainText}
                x={-effectiveBlockWidth / 2}
                y={-textTopOffset}
                width={effectiveBlockWidth}
                fontSize={fontSize}
                fontFamily={layer.fontFamily?.replace(/['"]/g, '') || 'Inter'}
                fontStyle={layer.fontWeight || '500'}
                fill={layer.color || '#ffffff'}
                align={align}
                direction={isRtl ? 'rtl' : 'ltr'}
                wrap="word"
                stroke={layer.strokeColor || 'transparent'}
                strokeWidth={layer.strokeWidth ?? 0}
                fillAfterStrokeEnabled
                lineHeight={lineHeight}
                letterSpacing={layer.letterSpacing ?? 0}
                listening={false}
              />
              {arrowLine != null && (
                <KonvaText
                  text={arrowLine}
                  x={-effectiveBlockWidth / 2}
                  y={-textTopOffset + arrowY}
                  width={effectiveBlockWidth}
                  fontSize={fontSize}
                  fontFamily={layer.fontFamily?.replace(/['"]/g, '') || 'Inter'}
                  fontStyle={layer.fontWeight || '500'}
                  fill={layer.color || '#ffffff'}
                  align="center"
                  direction="ltr"
                  wrap="word"
                  stroke={layer.strokeColor || 'transparent'}
                  strokeWidth={layer.strokeWidth ?? 0}
                  fillAfterStrokeEnabled
                  lineHeight={lineHeight}
                  letterSpacing={layer.letterSpacing ?? 0}
                  listening={false}
                />
              )}
            </Group>
          )
        })}
      </Layer>
    </Stage>
  )
}
