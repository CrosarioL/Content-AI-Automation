'use client'

import { useState, useCallback, useRef } from 'react'
import { Stage, Layer, Rect, Text as KonvaText, Group, Image as KonvaImage } from 'react-konva'
import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import { Download, Loader2, FolderArchive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SlideLayoutConfig, SlideTextLayer } from '@/types'

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920
const EXPORT_SCALE = 1 // Full resolution export

type TextVariantState = {
  id: string
  variant_label: string
  content: string
  layoutConfig: SlideLayoutConfig
}

type SlideState = {
  id: string
  slide_number: number
  slide_type: string
  title: string
  textVariants: TextVariantState[]
}

interface BatchExportProps {
  slides: SlideState[]
  ideaTitle: string
  persona: string
  country: string
}

// Hidden canvas renderer for high-quality exports
function SlideRenderer({
  layout,
  onRender,
}: {
  layout: SlideLayoutConfig
  onRender: (dataUrl: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)

  // Load background image if present
  useState(() => {
    if (layout.background?.image) {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => setBgImage(img)
      img.src = layout.background.image
    }
  })

  const handleExport = useCallback(async () => {
    if (!containerRef.current) return
    
    try {
      const dataUrl = await toPng(containerRef.current, {
        cacheBust: true,
        pixelRatio: EXPORT_SCALE,
        backgroundColor: layout.background?.color || '#0F1A2C',
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      })
      onRender(dataUrl)
    } catch (err) {
      console.error('Failed to render slide:', err)
      onRender('')
    }
  }, [layout, onRender])

  // Auto-trigger export after mount
  useState(() => {
    const timer = setTimeout(handleExport, 100)
    return () => clearTimeout(timer)
  })

  const orderedLayers = [...(layout.layers || [])].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: '-9999px',
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      }}
    >
      <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
        <Layer>
          <Rect
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            fill={layout.background?.color || '#0F1A2C'}
          />
          {bgImage && (
            <KonvaImage
              image={bgImage}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
            />
          )}
          {orderedLayers.map((layer) => (
            <Group
              key={layer.id}
              x={layer.position.x}
              y={layer.position.y}
              rotation={layer.rotation}
              opacity={layer.opacity}
            >
              <Rect
                width={layer.size.width}
                height={layer.size.height}
                fill={layer.background || 'transparent'}
                cornerRadius={24}
              />
              <KonvaText
                text={layer.text}
                width={layer.size.width}
                height={layer.size.height}
                fontSize={layer.fontSize}
                fontFamily={layer.fontFamily}
                fontStyle={layer.fontWeight}
                fill={layer.color}
                align={layer.align}
                padding={12}
                wrap="word"
              />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  )
}

export function BatchExport({ slides, ideaTitle, persona, country }: BatchExportProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [exportFormat, setExportFormat] = useState<'zip' | 'individual'>('zip')

  const exportAllSlides = useCallback(async () => {
    setIsExporting(true)
    
    // Collect all variants to export
    const toExport: { slide: SlideState; variant: TextVariantState; index: number }[] = []
    let idx = 0
    for (const slide of slides) {
      for (const variant of slide.textVariants) {
        if (variant.layoutConfig?.layers?.length > 0 || variant.content) {
          toExport.push({ slide, variant, index: idx++ })
        }
      }
    }

    if (toExport.length === 0) {
      alert('No slides with content to export')
      setIsExporting(false)
      return
    }

    setProgress({ current: 0, total: toExport.length })

    const exportedImages: { name: string; dataUrl: string }[] = []

    // Export each slide/variant
    for (let i = 0; i < toExport.length; i++) {
      const { slide, variant } = toExport[i]
      setProgress({ current: i + 1, total: toExport.length })

      // Create a temporary container for export
      const container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.width = `${CANVAS_WIDTH}px`
      container.style.height = `${CANVAS_HEIGHT}px`
      container.style.backgroundColor = variant.layoutConfig?.background?.color || '#0F1A2C'
      document.body.appendChild(container)

      try {
        // Render the slide to canvas
        const canvas = document.createElement('canvas')
        canvas.width = CANVAS_WIDTH
        canvas.height = CANVAS_HEIGHT
        const ctx = canvas.getContext('2d')
        
        if (ctx) {
          // Background color
          ctx.fillStyle = variant.layoutConfig?.background?.color || '#0F1A2C'
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

          // Background image if present
          if (variant.layoutConfig?.background?.image) {
            try {
              const bgImg = await loadImage(variant.layoutConfig.background.image)
              ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            } catch {
              // Ignore background image load failures
            }
          }

          // Render text layers
          const layers = [...(variant.layoutConfig?.layers || [])].sort((a, b) => a.zIndex - b.zIndex)
          for (const layer of layers) {
            ctx.save()
            ctx.globalAlpha = layer.opacity
            ctx.translate(layer.position.x, layer.position.y)
            ctx.rotate((layer.rotation * Math.PI) / 180)

            // Background rectangle
            if (layer.background && layer.background !== 'transparent') {
              ctx.fillStyle = layer.background
              roundRect(ctx, 0, 0, layer.size.width, layer.size.height, 24)
              ctx.fill()
            }

            // Text
            ctx.fillStyle = layer.color
            ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily.replace(/"/g, '')}`
            ctx.textAlign = layer.align as CanvasTextAlign
            ctx.textBaseline = 'top'
            
            const padding = 12
            const maxWidth = layer.size.width - padding * 2
            const lines = wrapText(ctx, layer.text, maxWidth)
            const lineHeight = layer.fontSize * 1.2
            
            let textX = padding
            if (layer.align === 'center') textX = layer.size.width / 2
            else if (layer.align === 'right') textX = layer.size.width - padding

            lines.forEach((line, lineIdx) => {
              ctx.fillText(line, textX, padding + lineIdx * lineHeight)
            })

            ctx.restore()
          }

          const dataUrl = canvas.toDataURL('image/png')
          const filename = `slide-${slide.slide_number}-${variant.variant_label.replace(/\s+/g, '-')}.png`
          exportedImages.push({ name: filename, dataUrl })
        }
      } catch (err) {
        console.error(`Failed to export slide ${slide.slide_number}:`, err)
      } finally {
        document.body.removeChild(container)
      }
    }

    // Create download
    if (exportFormat === 'zip') {
      const zip = new JSZip()
      const folder = zip.folder(`${ideaTitle}-${persona}-${country}`.replace(/\s+/g, '-'))
      
      for (const img of exportedImages) {
        // Convert data URL to blob
        const base64 = img.dataUrl.split(',')[1]
        folder?.file(img.name, base64, { base64: true })
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${ideaTitle}-${persona}-${country}-slides.zip`.replace(/\s+/g, '-')
      link.click()
      URL.revokeObjectURL(url)
    } else {
      // Download individually
      for (const img of exportedImages) {
        const link = document.createElement('a')
        link.href = img.dataUrl
        link.download = img.name
        link.click()
        await new Promise((r) => setTimeout(r, 100)) // Small delay between downloads
      }
    }

    setIsExporting(false)
    setProgress({ current: 0, total: 0 })
  }, [slides, ideaTitle, persona, country, exportFormat])

  return (
    <div className="flex items-center gap-2">
      <select
        value={exportFormat}
        onChange={(e) => setExportFormat(e.target.value as 'zip' | 'individual')}
        className="text-sm border border-border rounded-md px-2 py-1.5 bg-background"
        disabled={isExporting}
      >
        <option value="zip">ZIP Archive</option>
        <option value="individual">Individual Files</option>
      </select>
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={exportAllSlides}
        disabled={isExporting || slides.length === 0}
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            {progress.current}/{progress.total}
          </>
        ) : (
          <>
            <FolderArchive className="mr-1.5 h-4 w-4" />
            Export All
          </>
        )}
      </Button>
    </div>
  )
}

// Helper: Load image as promise
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Helper: Draw rounded rectangle
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

// Helper: Wrap text to fit width
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  
  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

