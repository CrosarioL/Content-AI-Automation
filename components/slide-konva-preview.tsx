'use client'

/**
 * Konva-based slide preview with TikTok-style per-line background pills.
 * Matches SlideExportCanvas visual output. Supports editor mode (drag, resize, rotate).
 */
import React, { useMemo, useRef } from 'react'
import { Stage, Layer, Rect, Text as KonvaText, Group, Image as KonvaImage } from 'react-konva'
import type { SlideLayoutConfig, SlideTextLayer } from '@/types'
import { measureTextLines, getEffectiveWrapWidth, hasArabicScript, isArrowOnlyLine, getTrailingArrowParts } from '@/lib/text-line-metrics'

const DEFAULT_WIDTH = 1080
const DEFAULT_HEIGHT = 1920

function getBackgroundImageLayout(
  image: HTMLImageElement | null,
  canvasWidth: number,
  canvasHeight: number,
  transform?: { scale?: number; x?: number; y?: number }
) {
  if (!image) {
    return null
  }

  const imgW = image.width || canvasWidth
  const imgH = image.height || canvasHeight

  // Base "cover" scale – fill canvas without distortion, then crop overflow
  const scaleBase = Math.max(canvasWidth / imgW, canvasHeight / imgH)
  const userScale = transform?.scale ?? 1
  const finalScale = scaleBase * userScale

  const renderWidth = imgW * finalScale
  const renderHeight = imgH * finalScale

  // Center image, then apply user pan offsets in pixels
  const offsetX = transform?.x ?? 0
  const offsetY = transform?.y ?? 0

  const x = (canvasWidth - renderWidth) / 2 + offsetX
  const y = (canvasHeight - renderHeight) / 2 + offsetY

  return { x, y, width: renderWidth, height: renderHeight }
}

function useKonvaImage(url: string | undefined) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null)
  React.useEffect(() => {
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

export interface SlideKonvaPreviewProps {
  layout: SlideLayoutConfig
  scale?: number
  backgroundImageUrl?: string
  imageTransform?: { scale?: number; x?: number; y?: number }
  showGuides?: boolean
  className?: string
  onLayerClick?: (layer: SlideTextLayer) => void
  selectedLayerId?: string | null
  /** Editor mode: enable drag overlay */
  onDragStart?: (layerId: string, e: React.PointerEvent) => void
  /** Editor mode: enable resize/rotate handle */
  onResizeRotateStart?: (layerId: string, e: React.PointerEvent, centerScreenX: number, centerScreenY: number) => void
}

export function SlideKonvaPreview({
  layout,
  scale = 1,
  backgroundImageUrl,
  imageTransform,
  showGuides = false,
  className = '',
  onLayerClick,
  selectedLayerId,
  onDragStart,
  onResizeRotateStart,
}: SlideKonvaPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bgImageUrl = backgroundImageUrl ?? layout.background?.image
  const backgroundImage = useKonvaImage(bgImageUrl)
  const bgColor = layout.background?.color || '#0F1A2C'
  const exportOverlay = layout.metadata?.exportOverlay as { color?: string; opacity?: number } | undefined
  const overlayOpacity = typeof exportOverlay?.opacity === 'number'
    ? Math.max(0, Math.min(exportOverlay.opacity, 1))
    : 0
  const layers = [...(layout.layers || [])].sort((a, b) => a.zIndex - b.zIndex)
  const CANVAS_WIDTH = layout.canvas?.width ?? DEFAULT_WIDTH
  const CANVAS_HEIGHT = layout.canvas?.height ?? DEFAULT_HEIGHT

  const bgLayout = useMemo(
    () => getBackgroundImageLayout(backgroundImage, CANVAS_WIDTH, CANVAS_HEIGHT, imageTransform),
    [backgroundImage, CANVAS_WIDTH, CANVAS_HEIGHT, imageTransform]
  )

  const measureCtx = useMemo(() => {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    return canvas.getContext('2d')
  }, [])

  const layerTextFingerprint = layers.map((l) => `${l.id}:${(l as { wrappedText?: string }).wrappedText ?? l.text ?? ''}`).join('|')
  const lineMetricsByLayer = useMemo(() => {
    const map = new Map<string, Array<{ text: string; width: number; y: number }>>()
    if (!measureCtx) return map
    for (const layer of layers) {
      const hasBackground = layer.background && layer.background !== 'transparent'
      const text = (layer as { wrappedText?: string }).wrappedText ?? layer.text ?? ''
      const wrapWidth = Math.max(layer.size?.width ?? 1000, 800)
      const opts = {
        wrapWidth,
        fontSize: layer.fontSize ?? 60,
        fontFamily: layer.fontFamily?.replace(/['"]/g, '') || 'Inter',
        fontWeight: layer.fontWeight || '500',
        lineHeight: layer.lineHeight ?? 1.2,
      }
      if (!hasBackground) continue
      const isRtl = hasArabicScript(text)
      const lines = text.split('\n')
      const hasArrowLastLine = lines.length >= 2 && isArrowOnlyLine(lines[lines.length - 1])
      const trailing = getTrailingArrowParts(text)
      const useArrowSplit = isRtl && (hasArrowLastLine || !!trailing)
      const textForMetrics = useArrowSplit ? (hasArrowLastLine ? lines.slice(0, -1).join('\n') : (trailing!.mainText)) : text
      const metrics = measureTextLines(measureCtx, { ...opts, text: textForMetrics })
      map.set(layer.id, metrics)
    }
    return map
  }, [measureCtx, layers, layerTextFingerprint])

  type ArrowInfo = { mainText: string; arrowLine: string; arrowY: number }
  const arrowInfoByLayer = useMemo(() => {
    const map = new Map<string, ArrowInfo>()
    if (!measureCtx) return map
    const lineHeightPx = (fontSize: number, lineHeight: number) => fontSize * (lineHeight ?? 1.2)
    for (const layer of layers) {
      const text = (layer as { wrappedText?: string }).wrappedText ?? layer.text ?? ''
      if (!hasArabicScript(text)) continue
      const wrapWidth = Math.max(layer.size?.width ?? 1000, 800)
      const fontSize = layer.fontSize ?? 60
      const lh = layer.lineHeight ?? 1.2
      const opts = {
        text,
        wrapWidth,
        fontSize,
        fontFamily: layer.fontFamily?.replace(/['"]/g, '') || 'Inter',
        fontWeight: layer.fontWeight || '500',
        lineHeight: lh,
      }
      const lines = text.split('\n')
      const hasArrowLastLine = lines.length >= 2 && isArrowOnlyLine(lines[lines.length - 1])
      const trailing = getTrailingArrowParts(text)
      if (hasArrowLastLine) {
        const mainText = lines.slice(0, -1).join('\n')
        const arrowLine = lines[lines.length - 1]
        const metrics = measureTextLines(measureCtx, { ...opts, text: mainText })
        map.set(layer.id, { mainText, arrowLine, arrowY: metrics.length * lineHeightPx(fontSize, lh) })
      } else if (trailing) {
        const metrics = measureTextLines(measureCtx, { ...opts, text: trailing.mainText })
        map.set(layer.id, { mainText: trailing.mainText, arrowLine: trailing.arrowLine, arrowY: metrics.length * lineHeightPx(fontSize, lh) })
      }
    }
    return map
  }, [measureCtx, layers, layerTextFingerprint])

  const isEditor = !!(onDragStart || onResizeRotateStart)

  return (
    <div
      ref={containerRef}
      className={className}
      data-slide-canvas
      style={{
        width: CANVAS_WIDTH * scale,
        height: CANVAS_HEIGHT * scale,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
        }}
      >
        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT} listening={!isEditor}>
          <Layer listening={false}>
            <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={bgColor} />
            {bgImageUrl && backgroundImage && bgLayout && (
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
          <Layer listening={false}>
            {layers.map((layer: SlideTextLayer) => {
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
                  scaleX={layer.scale?.x ?? 1}
                  scaleY={layer.scale?.y ?? 1}
                  rotation={layer.rotation ?? 0}
                  opacity={layer.opacity ?? 1}
                >
                  {hasBackground &&
                    (lineMetrics.length > 0 ? (
                      lineMetrics.map((metric, i) => {
                        const rectWidth = metric.width + pad * 2
                        let rectX: number
                        if (align === 'center') rectX = -rectWidth / 2
                        else if (align === 'right') rectX = effectiveBlockWidth / 2 - rectWidth
                        else rectX = -effectiveBlockWidth / 2 - pad
                        return (
                          <Rect
                            key={i}
                            x={rectX}
                            y={-textTopOffset + metric.y - pad}
                            width={rectWidth}
                            height={lineHeightPx + pad * 2}
                            fill={layer.background}
                            cornerRadius={8}
                          />
                        )
                      })
                    ) : (
                      <Rect
                        x={-effectiveBlockWidth / 2 - pad}
                        y={-textTopOffset - pad}
                        width={effectiveBlockWidth + pad * 2}
                        height={(layer.size?.height ?? fontSize * 3) + pad * 2}
                        fill={layer.background}
                        cornerRadius={10}
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
                    />
                  )}
                </Group>
              )
            })}
          </Layer>
        </Stage>

        {/* Editor overlays: interaction divs */}
        {isEditor &&
          layers.map((layer) => {
            const data = getLayerWrapperStyle(layer)
            const isSelected = selectedLayerId === layer.id
            return (
              <div
                key={layer.id}
                style={{
                  ...data,
                  cursor: onDragStart ? 'grab' : undefined,
                  outline: isSelected ? '2px dashed #E0C88C' : undefined,
                }}
                onClick={onLayerClick ? () => onLayerClick(layer) : undefined}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('[data-layer-handle]')) return
                  e.stopPropagation()
                  onDragStart?.(layer.id, e)
                }}
                role={onLayerClick ? 'button' : undefined}
              >
                {isSelected && onResizeRotateStart && (
                  <div
                    data-layer-handle="pivot"
                    role="button"
                    tabIndex={0}
                    aria-label="Resize and rotate"
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: '#E0C88C',
                      cursor: 'nwse-resize',
                      border: '2px solid #0F1A2C',
                      zIndex: 20,
                      pointerEvents: 'auto',
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const slideEl = containerRef.current
                      const slideRect = slideEl?.getBoundingClientRect()
                      if (slideRect) {
                        const centerScreenX =
                          slideRect.left + (layer.position.x / CANVAS_WIDTH) * slideRect.width
                        const centerScreenY =
                          slideRect.top + (layer.position.y / CANVAS_HEIGHT) * slideRect.height
                        onResizeRotateStart(layer.id, e, centerScreenX, centerScreenY)
                      }
                    }}
                  />
                )}
              </div>
            )
          })}

        {showGuides && (
          <>
            <div
              style={{
                position: 'absolute',
                left: layout.safeZone?.top ?? 180,
                top: layout.safeZone?.top ?? 180,
                width: CANVAS_WIDTH,
                height:
                  CANVAS_HEIGHT - (layout.safeZone?.top ?? 180) - (layout.safeZone?.bottom ?? 220),
                border: '1px dashed rgba(255,255,255,0.12)',
                borderRadius: 24,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: CANVAS_WIDTH / 2,
                top: 0,
                width: 1,
                height: CANVAS_HEIGHT,
                background: 'rgba(255,255,255,0.05)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: CANVAS_HEIGHT / 2,
                width: CANVAS_WIDTH,
                height: 1,
                background: 'rgba(255,255,255,0.05)',
                pointerEvents: 'none',
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function getLayerWrapperStyle(layer: SlideTextLayer): React.CSSProperties {
  const scaleX = layer.scale?.x ?? 1
  const scaleY = layer.scale?.y ?? 1
  const wrapWidth = Math.max(layer.size?.width ?? 1000, 800)
  const text = (layer as { wrappedText?: string }).wrappedText ?? layer.text ?? ''
  const width = getEffectiveWrapWidth(text, wrapWidth)
  const minH = (layer.size?.height ?? 80) || 80
  return {
    position: 'absolute',
    left: layer.position.x,
    top: layer.position.y,
    width,
    minHeight: minH,
    transform: `translate(-50%, -50%) rotate(${layer.rotation ?? 0}deg) scale(${scaleX}, ${scaleY})`,
    transformOrigin: 'center center',
    opacity: layer.opacity ?? 1,
  }
}
