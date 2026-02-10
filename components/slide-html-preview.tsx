'use client'

/**
 * Renders a slide using the same HTML/CSS structure as the backend (lib/renderer.ts).
 *
 * TikTok-style per-line backgrounds: measure line boxes with getClientRects(), draw
 * rounded-rect backgrounds on a <canvas> element behind the text. Zero CSS stacking issues.
 */
import React, { useLayoutEffect, useRef, useState, useCallback } from 'react'
import type { SlideLayoutConfig, SlideTextLayer } from '@/types'
import { getLayerRenderData } from '@/lib/slide-layer-styles'

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920

/**
 * Text with per-line background pills drawn on a <canvas> behind the text.
 * getClientRects() measures each line, then we paint rounded rects on the canvas.
 */
function TextWithPerLineBg({
  textStyle,
  displayText,
  background,
  wrapWidth,
  align,
  children,
}: {
  textStyle: React.CSSProperties
  displayText: string
  background: string
  wrapWidth: number
  align: string
  children?: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const spanRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const paintBackgrounds = useCallback(() => {
    const container = containerRef.current
    const span = spanRef.current
    const cvs = canvasRef.current
    if (!container || !span || !cvs) return

    // Compute effective scale (accounts for all parent CSS transforms)
    const domWidth = container.offsetWidth
    const domHeight = container.offsetHeight
    const screenRect = container.getBoundingClientRect()
    const effectiveScale = screenRect.width / domWidth || 1

    // Size the canvas to the container (in local/unscaled coordinates)
    cvs.width = domWidth
    cvs.height = domHeight

    const ctx = cvs.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, cvs.width, cvs.height)

    // Measure each line's bounding rect
    const lineRects = span.getClientRects()
    const hPad = 18
    const vPad = 2
    const radius = 8

    ctx.fillStyle = background
    for (const r of Array.from(lineRects)) {
      const x = (r.left - screenRect.left) / effectiveScale - hPad
      const y = (r.top - screenRect.top) / effectiveScale - vPad
      const w = r.width / effectiveScale + hPad * 2
      const h = r.height / effectiveScale + vPad * 2

      // Draw rounded rectangle
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + w - radius, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
      ctx.lineTo(x + w, y + h - radius)
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
      ctx.lineTo(x + radius, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
      ctx.fill()
    }
  }, [background])

  useLayoutEffect(() => {
    paintBackgrounds()
  }, [displayText, wrapWidth, textStyle.fontSize, textStyle.fontFamily, textStyle.fontWeight, textStyle.letterSpacing, paintBackgrounds])

  return (
    <div
      ref={containerRef}
      style={{
        width: wrapWidth,
        maxWidth: wrapWidth,
        position: 'relative',
        textAlign: align as any,
        wordBreak: 'normal',
        overflowWrap: 'break-word',
      }}
    >
      {/* Canvas for background pills — single element, no stacking issues */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
      {/* Text on top (normal flow, paints above absolutely-positioned canvas) */}
      <span
        ref={spanRef}
        style={{
          ...textStyle,
          position: 'relative',
          display: 'inline',
        }}
      >
        {displayText}
      </span>
      {children}
    </div>
  )
}

export interface SlideHTMLPreviewProps {
  layout: SlideLayoutConfig
  scale?: number
  backgroundImageUrl?: string
  imageTransform?: { scale?: number; x?: number; y?: number }
  showGuides?: boolean
  className?: string
  onLayerClick?: (layer: SlideTextLayer) => void
  selectedLayerId?: string | null
  renderLayerWrapper?: (layer: SlideTextLayer, content: React.ReactNode) => React.ReactNode
  renderHandles?: (layer: SlideTextLayer) => React.ReactNode
}

export function SlideHTMLPreview({
  layout,
  scale = 1,
  backgroundImageUrl,
  imageTransform,
  showGuides = false,
  className = '',
  onLayerClick,
  selectedLayerId,
  renderLayerWrapper,
  renderHandles,
}: SlideHTMLPreviewProps) {
  const bgColor = layout.background?.color || '#0F1A2C'
  const bgImage = backgroundImageUrl ?? layout.background?.image
  const layers = [...(layout.layers || [])].sort((a, b) => a.zIndex - b.zIndex)
  const imgScale = imageTransform?.scale ?? 1
  const imgX = imageTransform?.x ?? 0
  const imgY = imageTransform?.y ?? 0

  const slideStyle: React.CSSProperties = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    position: 'relative',
    backgroundColor: bgColor,
    backgroundImage: bgImage ? `url('${bgImage.replace(/'/g, "\\'")}')` : undefined,
    backgroundSize: bgImage ? `${(100 * imgScale).toFixed(1)}%` : 'cover',
    backgroundPosition: bgImage ? `${50 + (imgX / 10)}% ${50 + (imgY / 10)}%` : 'center',
    backgroundRepeat: 'no-repeat',
  }

  return (
    <div
      className={className}
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
        }}
      >
        <div style={slideStyle}>
          {layers.map((layer) => {
            const data = getLayerRenderData(layer)
            const isSelected = selectedLayerId === layer.id
            const wrapW = data.wrapWidth

            const innerContent = data.hasBackground ? (
              <TextWithPerLineBg
                textStyle={data.textStyle}
                displayText={data.displayText}
                background={layer.background!}
                wrapWidth={wrapW}
                align={layer.align || 'center'}
              >
                {renderHandles ? renderHandles(layer) : null}
              </TextWithPerLineBg>
            ) : (
              <div
                style={{
                  width: wrapW,
                  maxWidth: wrapW,
                  position: 'relative',
                  textAlign: (layer.align || 'center') as any,
                  wordBreak: 'normal',
                  overflowWrap: 'break-word',
                }}
              >
                <span
                  style={{
                    ...data.textStyle,
                    display: 'block',
                    boxSizing: 'border-box',
                  }}
                >
                  {data.displayText}
                </span>
                {renderHandles ? renderHandles(layer) : null}
              </div>
            )

            const contentWrapperStyle: React.CSSProperties = {
              ...data.containerTransformStyle,
              width: wrapW,
              maxWidth: wrapW,
              outline: isSelected ? '2px dashed #E0C88C' : undefined,
            }

            const content = renderLayerWrapper ? (
              <div style={contentWrapperStyle}>
                {innerContent}
              </div>
            ) : (
              <div
                style={{
                  ...data.containerStyle,
                  width: wrapW,
                  outline: isSelected ? '2px dashed #E0C88C' : undefined,
                  cursor: onLayerClick ? 'pointer' : undefined,
                }}
                onClick={onLayerClick ? () => onLayerClick(layer) : undefined}
                role={onLayerClick ? 'button' : undefined}
              >
                {innerContent}
              </div>
            )

            const wrapped = renderLayerWrapper ? renderLayerWrapper(layer, content) : content
            return <div key={layer.id}>{wrapped}</div>
          })}

          {showGuides && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: layout.safeZone?.top ?? 180,
                  top: layout.safeZone?.top ?? 180,
                  width: CANVAS_WIDTH - 0,
                  height: CANVAS_HEIGHT - (layout.safeZone?.top ?? 180) - (layout.safeZone?.bottom ?? 220),
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
    </div>
  )
}
