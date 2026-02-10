'use client'

/**
 * Headless page that renders a single slide with Konva.
 * Used by the export flow (Puppeteer) so the exported image is exactly what the editor shows.
 * Query: layout (base64 JSON, UTF-8). Image URL is in layout.background.image.
 * Sets data-ready="true" when rendered so Puppeteer knows when to screenshot.
 */
import { useSearchParams } from 'next/navigation'
import { useMemo, useState, useEffect, useRef } from 'react'
import { SlideExportCanvas } from '@/components/slide-export-canvas'
import type { SlideLayoutConfig } from '@/types'

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920

function base64ToUtf8(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export default function RenderSlidePage() {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { layout, imageUrl } = useMemo(() => {
    if (typeof window === 'undefined') return { layout: null, imageUrl: '' }
    try {
      const layoutB64 = searchParams.get('layout')
      if (!layoutB64) return { layout: null, imageUrl: '' }
      const layout = JSON.parse(base64ToUtf8(layoutB64)) as SlideLayoutConfig
      const imageUrl = layout.background?.image || ''
      return { layout, imageUrl }
    } catch {
      return { layout: null, imageUrl: '' }
    }
  }, [searchParams])

  useEffect(() => setMounted(true), [])

  const handleReady = () => {
    if (containerRef.current) {
      containerRef.current.setAttribute('data-ready', 'true')
    }
  }

  if (!mounted || !layout) {
    return (
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          background: '#0F1A2C',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <SlideExportCanvas
        layout={layout}
        backgroundImageUrl={imageUrl || undefined}
        onReady={handleReady}
      />
    </div>
  )
}
