'use client'

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
import { toPng } from 'html-to-image'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  Download,
  ImageIcon,
  MoveDown,
  MoveUp,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Sparkles,
  X,
} from 'lucide-react'
import type { SlideLayoutConfig, SlideTextLayer } from '@/types'
import { Button } from '@/components/ui/button'
import { SlideKonvaPreview } from '@/components/slide-konva-preview'

const CLIPBOARD_KEY = 'hayattime-layer-clipboard'

// Helper to get canvas dimensions based on aspect ratio
const getCanvasDimensions = (aspectRatio: import('@/types').AspectRatio = '9:16') => {
  const BASE_WIDTH = 1080
  if (aspectRatio === '3:4') {
    return {
      width: BASE_WIDTH,
      height: Math.round(BASE_WIDTH * (4 / 3)), // 1440
    }
  } else {
    // 9:16
    return {
      width: BASE_WIDTH,
      height: Math.round(BASE_WIDTH * (16 / 9)), // 1920
    }
  }
}

const VIEWPORT_WIDTH = 360
const FONT_SIZE_RATIO = 0.65 // 65% of box width - TikTok style

const defaultLayoutConfig = (aspectRatio: import('@/types').AspectRatio = '9:16'): SlideLayoutConfig => {
  const canvas = getCanvasDimensions(aspectRatio)
  return {
    version: 1,
    canvas,
    safeZone: { top: 180, bottom: 220 },
    background: { color: '#0F1A2C' },
    layers: [],
  }
}

const defaultLayer = (text: string, canvasWidth: number = 1080, canvasHeight: number = 1920): SlideTextLayer => ({
  id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  type: 'text',
  text,
  // TikTok Sans stack with sensible fallbacks (loaded via Google Fonts or @fontsource)
  fontFamily: '"TikTok Sans", "TikTok Sans Text", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  // Visually match TikTok's default text thickness for "Regular"
  fontWeight: '500',
  fontSize: 60, // default base size (scale controls visual size)
  color: '#ffffff',
  background: 'transparent',
  align: 'center',
  position: { x: canvasWidth / 2 - 500, y: canvasHeight / 2 - 100 },
  size: { width: 1000, height: 200 }, // TikTok-style: ~20+ chars per line before wrap
  rotation: 0,
  scale: { x: 1.5, y: 1.5 },
  opacity: 1,
  zIndex: 0,
  startMs: 0,
  endMs: 6000,
  strokeColor: '#000000',
  strokeWidth: 10, // slightly reduced outline thickness
  shadowColor: 'rgba(0,0,0,0.3)',
  shadowBlur: 1,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  letterSpacing: 2, // increased spacing to prevent overlap
  lineHeight: 1.05, // close to native vertical spacing
  preset: 'tiktok-classic',
})

const FONT_OPTIONS = [
  { label: 'TikTok Sans', fontFamily: '"TikTok Sans", "TikTok Sans Text", system-ui, -apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '900' },
  { label: 'Montserrat Bold', fontFamily: 'var(--font-montserrat), Montserrat, "Arial Black", sans-serif', fontWeight: '900' },
  { label: 'Condensed Bold', fontFamily: 'var(--font-oswald), Oswald, "Impact", sans-serif', fontWeight: '700' },
  { label: 'Modern Bold', fontFamily: 'var(--font-poppins), Poppins, sans-serif', fontWeight: '800' },
  { label: 'Clean Bold', fontFamily: '"Inter", "SF Pro Display", sans-serif', fontWeight: '800' },
  { label: 'Rounded', fontFamily: 'var(--font-nunito), Nunito, "Arial Rounded MT Bold", sans-serif', fontWeight: '800' },
  { label: 'Classic Sans', fontFamily: '"Arial", "Helvetica", sans-serif', fontWeight: '700' },
  // TikTok in-app lookalikes (legal + close)
  { label: 'Elegance (Serif)', fontFamily: 'var(--font-playfair), "Playfair Display", serif', fontWeight: '700' },
  { label: 'Typewriter', fontFamily: 'var(--font-source-code-pro), "Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontWeight: '700' },
  { label: 'Handwriting', fontFamily: 'var(--font-yesteryear), "Yesteryear", cursive', fontWeight: '400' },
  { label: 'Neon (Geometric)', fontFamily: 'var(--font-abel), Abel, system-ui, sans-serif', fontWeight: '400' },
  { label: 'Serif', fontFamily: 'var(--font-libre-baskerville), "Libre Baskerville", Georgia, serif', fontWeight: '700' },
]

// TikTok-style presets - authentic look
const STYLE_PRESETS = [
  {
    id: 'custom',
    label: 'Custom',
    apply: (layer: SlideTextLayer) => layer,
  },
  {
    id: 'tiktok-label',
    label: 'TikTok Label',
    apply: (layer: SlideTextLayer): SlideTextLayer => ({
      ...layer,
      color: '#000000', // black text
      background: '#ffffff', // white background fill (TikTok label style)
      strokeColor: 'transparent', // no outline for label style
      strokeWidth: 0,
      shadowColor: 'transparent',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      fontFamily: '"TikTok Sans", "TikTok Sans Text", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: layer.fontWeight || '600', // slightly bold label
      fontSize: layer.fontSize || 60,
      letterSpacing: 0,
      lineHeight: 1.1,
      preset: 'tiktok-label',
    }),
  },
  {
    id: 'tiktok-classic',
    label: 'TikTok Classic',
    apply: (layer: SlideTextLayer): SlideTextLayer => ({
      ...layer,
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 10, // slightly reduced outline thickness
      shadowColor: 'rgba(0,0,0,0.3)',
      shadowBlur: 1,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      background: 'transparent',
      fontFamily: '"TikTok Sans", "TikTok Sans Text", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      // keep existing weight if user picked one, default to 500 (TikTok-style regular)
      fontWeight: layer.fontWeight || '500',
      fontSize: layer.fontSize || 60, // default size, thickness via weight
      letterSpacing: 2, // increased spacing to prevent overlap
      lineHeight: 1.05, // closer to native vertical spacing
      preset: 'tiktok-classic',
    }),
  },
  {
    id: 'tiktok-yellow',
    label: 'TikTok Yellow',
    apply: (layer: SlideTextLayer): SlideTextLayer => ({
      ...layer,
      color: '#fffc00',
      strokeColor: '#000000',
      strokeWidth: 10,
      shadowColor: 'rgba(0,0,0,0.3)',
      shadowBlur: 2,
      shadowOffsetX: 1,
      shadowOffsetY: 1,
      background: 'transparent',
      fontFamily: 'var(--font-montserrat), Montserrat, "Arial Black", "Impact", sans-serif',
      fontWeight: '900',
      letterSpacing: 0, // Natural spacing
      lineHeight: 1.25, // Comfortable line height
      preset: 'tiktok-yellow',
    }),
  },
  {
    id: 'tiktok-red',
    label: 'TikTok Red',
    apply: (layer: SlideTextLayer): SlideTextLayer => ({
      ...layer,
      color: '#ff3b5c',
      strokeColor: '#000000',
      strokeWidth: 10,
      shadowColor: 'rgba(0,0,0,0.3)',
      shadowBlur: 2,
      shadowOffsetX: 1,
      shadowOffsetY: 1,
      background: 'transparent',
      fontFamily: 'var(--font-montserrat), Montserrat, "Arial Black", "Impact", sans-serif',
      fontWeight: '900',
      letterSpacing: 0, // Natural spacing
      lineHeight: 1.25, // Comfortable line height
      preset: 'tiktok-red',
    }),
  },
  {
    id: 'bold-outline',
    label: 'Bold Outline',
    apply: (layer: SlideTextLayer): SlideTextLayer => ({
      ...layer,
      color: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 8,
      shadowBlur: 0,
      background: 'transparent',
      fontWeight: '800',
      preset: 'bold-outline',
    }),
  },
  {
    id: 'caption',
    label: 'Caption Style',
    apply: (layer: SlideTextLayer): SlideTextLayer => ({
      ...layer,
      color: '#ffffff',
      strokeColor: 'transparent',
      strokeWidth: 0,
      background: 'rgba(0,0,0,0.7)',
      shadowBlur: 0,
      preset: 'caption',
    }),
  },
  {
    id: 'neon',
    label: 'Neon Glow',
    apply: (layer: SlideTextLayer): SlideTextLayer => ({
      ...layer,
      color: '#00ff88',
      strokeColor: '#00ff88',
      strokeWidth: 2,
      shadowColor: '#00ff88',
      shadowBlur: 20,
      background: 'transparent',
      preset: 'neon',
    }),
  },
]

export interface TiktokSlideEditorHandle {
  getWrappedTextForLayers: () => Record<string, string>
}

interface TiktokSlideEditorProps {
  variantId: string
  variantLabel: string
  content: string
  layoutConfig?: SlideLayoutConfig
  onContentChange: (content: string) => void
  onLayoutChange: (config: SlideLayoutConfig) => void
  hideBackgroundUpload?: boolean // When true, hides background image upload (for v2 mass poster)
  compactLayout?: boolean // When true, stacks canvas and controls vertically instead of side-by-side
  previewBackgroundImage?: string // Optional preview image URL (e.g., from image pool) - doesn't affect saved layout
  previewImageTransform?: import('@/types').ImageTransform // Transform settings for preview image
  previewImageId?: string // ID of the preview image (for saving transforms)
  onImageTransformChange?: (imageId: string, transform: import('@/types').ImageTransform) => void // Callback to save transform
  aspectRatio?: import('@/types').AspectRatio // Canvas aspect ratio (9:16 or 3:4)
}

export const TiktokSlideEditor = forwardRef<TiktokSlideEditorHandle, TiktokSlideEditorProps>(function TiktokSlideEditor({
  variantId,
  variantLabel,
  content,
  layoutConfig,
  onContentChange,
  onLayoutChange,
  hideBackgroundUpload = false,
  compactLayout = false,
  previewBackgroundImage,
  previewImageTransform,
  previewImageId,
  onImageTransformChange,
  aspectRatio = '9:16',
}, ref) {
  // Calculate canvas dimensions and viewport scale
  const canvasDimensions = useMemo(() => getCanvasDimensions(aspectRatio), [aspectRatio])
  const SCALE = VIEWPORT_WIDTH / canvasDimensions.width
  const VIEWPORT_HEIGHT = canvasDimensions.height * SCALE
  
  // Only normalize layout when variant changes or initial load - don't reset on every prop change
  // Keep normalizedLayout for initial state, but don't let it trigger resets
  const normalizedLayout = useMemo(() => {
    const incoming = layoutConfig || defaultLayoutConfig(aspectRatio)
    return {
      ...incoming,
      canvas: canvasDimensions,
      safeZone: incoming.safeZone || { top: 180, bottom: 220 },
      background: incoming.background || { color: '#0F1A2C' },
      layers: (incoming.layers || []).map((layer, idx) => ({
        ...layer,
        zIndex: typeof layer.zIndex === 'number' ? layer.zIndex : idx,
        // Preserve fontSize if it exists, otherwise calculate from box width using ratio
        fontSize: layer.fontSize || (layer.size?.width || 400) * FONT_SIZE_RATIO,
      })),
    }
  }, [layoutConfig, aspectRatio, canvasDimensions]) // Keep dependency on layoutConfig but useEffect won't use this

  // Store initial layout in ref to prevent resets - only set once on mount
  const initialLayoutRef = useRef<SlideLayoutConfig | null>(null)
  const hasInitializedRef = useRef(false)
  
  if (!hasInitializedRef.current) {
    initialLayoutRef.current = normalizedLayout
    hasInitializedRef.current = true
  }
  
  const [layout, setLayout] = useState<SlideLayoutConfig>(() => initialLayoutRef.current || normalizedLayout)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(() => 
    (initialLayoutRef.current || normalizedLayout).layers.at(-1)?.id ?? null
  )
  const [isUploadingBg, setIsUploadingBg] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<SlideLayoutConfig[]>([])
  const dragStartRef = useRef<{ layerId: string; x: number; y: number; posX: number; posY: number } | null>(null)
  const dragCurrentRef = useRef<{ x: number; y: number } | null>(null)
  const rotateStartRef = useRef<{ rotation: number; startAngle: number; centerX: number; centerY: number } | null>(null)
  const combinedPivotRef = useRef<{
    scale: number
    rotation: number
    startAngle: number
    startDistance: number
    centerX: number
    centerY: number
  } | null>(null)
  const [liveDrag, setLiveDrag] = useState<{ layerId: string; x: number; y: number } | null>(null)
  const [liveScale, setLiveScale] = useState<{ layerId: string; scale: number } | null>(null)
  const [liveRotation, setLiveRotation] = useState<{ layerId: string; rotation: number } | null>(null)
  const scaleCurrentRef = useRef<number | null>(null)
  const rotationCurrentRef = useRef<number | null>(null)
  // Keep layout ref in sync for saveTextOnBlur (avoids stale closure)
  const layoutRef = useRef<SlideLayoutConfig | null>(null)
  layoutRef.current = layout

  // Display layout: merge live drag/scale/rotate so preview updates during interaction
  const displayLayout = useMemo(() => {
    if (!liveDrag && !liveScale && !liveRotation) return layout
    return {
      ...layout,
      layers: layout.layers.map((l) => ({
        ...l,
        position: liveDrag?.layerId === l.id ? { x: liveDrag.x, y: liveDrag.y } : l.position,
        scale: liveScale?.layerId === l.id ? { x: liveScale.scale, y: liveScale.scale } : l.scale,
        rotation: liveRotation?.layerId === l.id ? (liveRotation.rotation ?? l.rotation) : l.rotation,
      })),
    }
  }, [layout, liveDrag, liveScale, liveRotation])

  if (historyRef.current.length === 0) {
    historyRef.current = [initialLayoutRef.current || normalizedLayout]
  }
  const historyIndexRef = useRef(0)
  const selfEditRef = useRef(false) // tracks when layout change originates from this editor
  const bgInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    getWrappedTextForLayers: () => ({}), // HTML/CSS editor: backend wraps the same, no sync needed
  }), [])

  const backgroundImageUrl = previewBackgroundImage || layout.background?.image
  
  // Image transform state (zoom, pan, crop)
  const [imageTransform, setImageTransform] = useState<import('@/types').ImageTransform>(
    previewImageTransform || { scale: 1.0, x: 0, y: 0 }
  )
  
  // Update transform when preview image changes
  useEffect(() => {
    if (previewImageTransform) {
      setImageTransform(previewImageTransform)
    } else if (previewBackgroundImage) {
      // Reset transform when switching to a new image without transform
      setImageTransform({ scale: 1.0, x: 0, y: 0 })
    }
  }, [previewImageTransform, previewBackgroundImage])
  
  // Save transform when it changes (debounced)
  useEffect(() => {
    if (previewImageId && onImageTransformChange && previewBackgroundImage) {
      const timer = setTimeout(() => {
        onImageTransformChange(previewImageId, imageTransform)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [imageTransform.scale, imageTransform.x, imageTransform.y, previewImageId, previewBackgroundImage, onImageTransformChange])

  // Sync from parent when variant changes OR when incoming content/layout text changes
  // (e.g. country switch, external edits, different variant selected).
  // Build a fingerprint of the incoming layout's text so we detect actual content changes.
  const incomingTextKey = useMemo(() => {
    const layers = layoutConfig?.layers || []
    return layers.map((l) => `${l.id}:${l.text ?? ''}`).join('|')
  }, [layoutConfig?.layers])

  const prevIncomingTextKeyRef = useRef(incomingTextKey)
  const prevVariantRef = useRef(variantId)

  useEffect(() => {
    const variantChanged = prevVariantRef.current !== variantId
    const textChanged = prevIncomingTextKeyRef.current !== incomingTextKey
    prevVariantRef.current = variantId
    prevIncomingTextKeyRef.current = incomingTextKey

    // Skip if change came from our own editor (commitLayout → onLayoutChange → parent re-renders)
    if (selfEditRef.current) {
      selfEditRef.current = false
      return
    }

    if (!variantChanged && !textChanged) return

    // Read directly from layoutConfig prop to avoid stale closures
    const incoming = layoutConfig || defaultLayoutConfig(aspectRatio)
    const updatedLayout = {
      ...incoming,
      canvas: canvasDimensions,
      safeZone: incoming.safeZone || { top: 180, bottom: 220 },
      background: incoming.background || { color: '#0F1A2C' },
      layers: (incoming.layers || []).map((layer, idx) => ({
        ...layer,
        zIndex: typeof layer.zIndex === 'number' ? layer.zIndex : idx,
      })),
    }
    setLayout(updatedLayout)
    initialLayoutRef.current = updatedLayout
    historyRef.current = [updatedLayout]
    historyIndexRef.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, incomingTextKey, aspectRatio])

  useEffect(() => {
    if (selectedLayerId && !layout.layers.find((layer) => layer.id === selectedLayerId)) {
      setSelectedLayerId(layout.layers.at(-1)?.id ?? null)
    }
  }, [layout.layers, selectedLayerId])

  const commitLayout = useCallback(
    (updater: (prev: SlideLayoutConfig) => SlideLayoutConfig) => {
      setLayout((prev) => {
        const updated = updater(prev)
        const stamped: SlideLayoutConfig = {
          ...updated,
          lastModifiedAt: new Date().toISOString(),
        }
        historyRef.current = [
          ...historyRef.current.slice(0, historyIndexRef.current + 1),
          stamped,
        ]
        historyIndexRef.current = historyRef.current.length - 1
        // Call onLayoutChange to update parent state (but NOT server save - that's only on button click)
        // Mark as self-edit so the sync effect doesn't reset us
        selfEditRef.current = true
        if (onLayoutChange) {
          onLayoutChange(stamped)
        }
        return stamped
      })
    },
    [onLayoutChange]
  )

  const undo = useCallback(() => {
    if (historyIndexRef.current === 0) return
    historyIndexRef.current -= 1
    const snapshot = historyRef.current[historyIndexRef.current]
    setLayout(snapshot)
    // DO NOT call onLayoutChange - no auto-save
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    const snapshot = historyRef.current[historyIndexRef.current]
    setLayout(snapshot)
    // DO NOT call onLayoutChange - no auto-save
  }, [])

  const orderedLayers = useMemo(
    () => [...layout.layers].sort((a, b) => a.zIndex - b.zIndex),
    [layout.layers]
  )

  const activeLayer = orderedLayers.find((layer) => layer.id === selectedLayerId) || null

  // Preview uses displayLayout directly - layout is updated on every keystroke
  const previewLayout = displayLayout

  const addLayer = () => {
    const nextLayer = defaultLayer(`Text ${layout.layers.length + 1}`, layout.canvas.width, layout.canvas.height)
    // fontSize is already calculated correctly in defaultLayer using FONT_SIZE_RATIO
    const layerWithLargeFont = {
      ...nextLayer,
      zIndex: layout.layers.length
    }
    commitLayout((prev) => ({
      ...prev,
      layers: [...prev.layers, layerWithLargeFont],
    }))
    setSelectedLayerId(nextLayer.id)
  }

  const removeLayer = (layerId: string) => {
    commitLayout((prev) => ({
      ...prev,
      layers: prev.layers
        .filter((layer) => layer.id !== layerId)
        .map((layer, idx) => ({ ...layer, zIndex: idx })),
    }))
  }

  const updateLayer = (layerId: string, updates: Partial<SlideTextLayer>) => {
    commitLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) =>
        layer.id === layerId ? { ...layer, ...updates } : layer
      ),
    }))
  }

  // Update text directly in layout - preview updates immediately (no overlay needed)
  const updateTextLocal = useCallback((layerId: string, text: string) => {
    setLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === layerId ? { ...l, text } : l)),
    }))
  }, [])

  // On blur: sync to parent and add to history (don't update layout - already has text)
  const saveTextOnBlur = useCallback((layerId: string) => {
    const current = layoutRef.current
    if (!current || !onLayoutChange) return
    const stamped: SlideLayoutConfig = {
      ...current,
      lastModifiedAt: new Date().toISOString(),
    }
    historyRef.current = [
      ...historyRef.current.slice(0, historyIndexRef.current + 1),
      stamped,
    ]
    historyIndexRef.current = historyRef.current.length - 1
    selfEditRef.current = true
    onLayoutChange(stamped)
  }, [onLayoutChange])

  const moveLayer = (layerId: string, direction: 'up' | 'down') => {
    commitLayout((prev) => {
      const layers = [...prev.layers]
      const idx = layers.findIndex((layer) => layer.id === layerId)
      if (idx === -1) return prev
      const targetIndex =
        direction === 'up' ? Math.max(0, idx - 1) : Math.min(layers.length - 1, idx + 1)
      if (idx === targetIndex) return prev
      const [item] = layers.splice(idx, 1)
      layers.splice(targetIndex, 0, item)
      return {
        ...prev,
        layers: layers.map((layer, index) => ({ ...layer, zIndex: index })),
      }
    })
  }

  // Removed snapPosition - we don't want auto-positioning constraints

  const handleLayerPositionChange = useCallback((layerId: string, position: { x: number; y: number }) => {
    commitLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, position } : l
      ),
    }))
  }, [commitLayout])

  const handleLayerScaleChange = useCallback((layerId: string, scale: { x: number; y: number }) => {
    commitLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, scale } : l
      ),
    }))
  }, [commitLayout])

  const handleLayerRotationChange = useCallback((layerId: string, rotation: number) => {
    commitLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === layerId ? { ...l, rotation } : l
      ),
    }))
  }, [commitLayout])

  const startDrag = useCallback((layerId: string, e: React.PointerEvent) => {
    e.preventDefault()
    const layer = layout.layers.find((l) => l.id === layerId)
    if (!layer) return
    dragStartRef.current = {
      layerId,
      x: e.clientX,
      y: e.clientY,
      posX: layer.position.x,
      posY: layer.position.y,
    }
    dragCurrentRef.current = { x: layer.position.x, y: layer.position.y }
    setLiveDrag({ layerId, x: layer.position.x, y: layer.position.y })
    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return
      const x = dragStartRef.current.posX + (ev.clientX - dragStartRef.current.x) / SCALE
      const y = dragStartRef.current.posY + (ev.clientY - dragStartRef.current.y) / SCALE
      dragCurrentRef.current = { x, y }
      setLiveDrag({ layerId: dragStartRef.current.layerId, x, y })
    }
    const onUp = () => {
      if (dragStartRef.current && dragCurrentRef.current) {
        handleLayerPositionChange(dragStartRef.current.layerId, dragCurrentRef.current)
      }
      setLiveDrag(null)
      dragCurrentRef.current = null
      dragStartRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [layout.layers, SCALE, handleLayerPositionChange])

  const startRotate = useCallback((layerId: string, e: React.PointerEvent, centerScreenX: number, centerScreenY: number) => {
    e.preventDefault()
    e.stopPropagation()
    const layer = layout.layers.find((l) => l.id === layerId)
    if (!layer) return
    const startAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX)
    const startRot = layer.rotation ?? 0
    rotateStartRef.current = {
      rotation: startRot,
      startAngle,
      centerX: centerScreenX,
      centerY: centerScreenY,
    }
    rotationCurrentRef.current = startRot
    setLiveRotation({ layerId, rotation: startRot })
    const onMove = (ev: PointerEvent) => {
      if (!rotateStartRef.current) return
      const currentAngle = Math.atan2(ev.clientY - rotateStartRef.current.centerY, ev.clientX - rotateStartRef.current.centerX)
      const deltaDeg = ((currentAngle - rotateStartRef.current.startAngle) * 180) / Math.PI
      let newRot = rotateStartRef.current.rotation + deltaDeg
      while (newRot > 180) newRot -= 360
      while (newRot < -180) newRot += 360
      rotationCurrentRef.current = newRot
      setLiveRotation({ layerId, rotation: newRot })
    }
    const onUp = () => {
      const r = rotationCurrentRef.current
      if (r != null) handleLayerRotationChange(layerId, r)
      setLiveRotation(null)
      rotationCurrentRef.current = null
      rotateStartRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [layout.layers, handleLayerRotationChange])

  const startResizeAndRotate = useCallback(
    (layerId: string, e: React.PointerEvent, centerScreenX: number, centerScreenY: number) => {
      e.preventDefault()
      e.stopPropagation()
      const layer = layout.layers.find((l) => l.id === layerId)
      if (!layer) return
      const startScale = layer.scale?.x ?? 1
      const startRot = layer.rotation ?? 0
      const dx = e.clientX - centerScreenX
      const dy = e.clientY - centerScreenY
      const startAngle = Math.atan2(dy, dx)
      const rawDistance = Math.hypot(dx, dy)
      const startDistance = Math.max(rawDistance, 50)
      combinedPivotRef.current = {
        scale: startScale,
        rotation: startRot,
        startAngle,
        startDistance,
        centerX: centerScreenX,
        centerY: centerScreenY,
      }
      scaleCurrentRef.current = startScale
      rotationCurrentRef.current = startRot
      setLiveScale({ layerId, scale: startScale })
      setLiveRotation({ layerId, rotation: startRot })
      const onMove = (ev: PointerEvent) => {
        if (!combinedPivotRef.current) return
        const { startAngle: sa, startDistance: sd, scale, rotation, centerX, centerY } = combinedPivotRef.current
        const cx = ev.clientX - centerX
        const cy = ev.clientY - centerY
        const currentAngle = Math.atan2(cy, cx)
        const currentDistance = Math.max(Math.hypot(cx, cy), 10)
        const scaleFactor = currentDistance / sd
        const dampedFactor = 1 + (scaleFactor - 1) * 0.4
        const newScale = Math.max(0.4, Math.min(3, scale * dampedFactor))
        const angleDeltaDeg = ((currentAngle - sa) * 180) / Math.PI
        let newRot = rotation + angleDeltaDeg
        while (newRot > 180) newRot -= 360
        while (newRot < -180) newRot += 360
        scaleCurrentRef.current = newScale
        rotationCurrentRef.current = newRot
        setLiveScale({ layerId, scale: newScale })
        setLiveRotation({ layerId, rotation: newRot })
      }
      const onUp = () => {
        const s = scaleCurrentRef.current
        const r = rotationCurrentRef.current
        if (s != null) handleLayerScaleChange(layerId, { x: s, y: s })
        if (r != null) handleLayerRotationChange(layerId, r)
        setLiveScale(null)
        setLiveRotation(null)
        scaleCurrentRef.current = null
        rotationCurrentRef.current = null
        combinedPivotRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [layout.layers, handleLayerScaleChange, handleLayerRotationChange]
  )

  const copyLayerToClipboard = () => {
    if (!activeLayer) return
    window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(activeLayer))
  }

  const pasteLayerFromClipboard = () => {
    const raw = window.localStorage.getItem(CLIPBOARD_KEY)
    if (!raw) return
    try {
      const layer = JSON.parse(raw) as SlideTextLayer
      const pasted: SlideTextLayer = {
        ...layer,
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        position: {
          // Don't constrain - allow off-screen positioning
          x: layer.position.x + 32,
          y: layer.position.y + 32,
        },
      }
      commitLayout((prev) => ({
        ...prev,
        layers: [...prev.layers, { ...pasted, zIndex: prev.layers.length }],
      }))
      setSelectedLayerId(pasted.id)
    } catch {
      // ignore malformed clipboard content
    }
  }

  const syncScriptFromLayers = () => {
    const aggregated = layout.layers
      .map((layer) => layer.text.trim())
      .filter((text) => text.length > 0)
      .join('\n')
    if (aggregated.length > 0 && aggregated !== content.trim()) {
      onContentChange(aggregated)
    }
  }

  const handleBackgroundUpload = async (file: File | null) => {
    if (!file) return
    setIsUploadingBg(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ideaId', variantId)
      formData.append('type', 'background')
      
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload background')
      }
      
      const data = await response.json()
      commitLayout((prev) => ({
        ...prev,
        background: {
          ...prev.background,
          image: data.url,
        },
      }))
    } catch (err) {
      console.error('Background upload failed:', err)
    } finally {
      setIsUploadingBg(false)
    }
  }

  const removeBackgroundImage = () => {
    commitLayout((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        image: undefined,
      },
    }))
  }

  const updateBackgroundColor = (color: string) => {
    commitLayout((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        color,
      },
    }))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Don't intercept backspace/delete if user is typing in an input field
      const activeElement = document.activeElement as HTMLElement | null
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
      )
      
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedLayerId && !isTyping) {
          event.preventDefault()
          removeLayer(selectedLayerId)
        }
      }
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
          event.preventDefault()
          undo()
        } else if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') {
          event.preventDefault()
          redo()
        } else if (event.key.toLowerCase() === 'c') {
          event.preventDefault()
          copyLayerToClipboard()
        } else if (event.key.toLowerCase() === 'v') {
          event.preventDefault()
          pasteLayerFromClipboard()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedLayerId, undo, redo])

  const downloadPng = async () => {
    if (!downloadRef.current) return
    const dataUrl = await toPng(downloadRef.current, {
      cacheBust: true,
      pixelRatio: canvasDimensions.width / VIEWPORT_WIDTH,
      backgroundColor: layout.background?.color || '#0F1A2C',
      width: canvasDimensions.width,
      height: canvasDimensions.height,
    })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${variantLabel || 'slide'}.png`
    link.click()
  }

  return (
    <div className="space-y-3 w-full">
      <div className={`grid gap-4 ${compactLayout ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,380px),1fr]'} max-w-full`}>
        <div>
          <div
            ref={downloadRef}
            data-slide-canvas
            className="relative mx-auto w-[360px] rounded-[28px] border border-border bg-[#030711]"
            style={{ height: VIEWPORT_HEIGHT, overflow: 'hidden' }}
          >
            <SlideKonvaPreview
              layout={previewLayout}
              scale={SCALE}
              backgroundImageUrl={backgroundImageUrl}
              imageTransform={imageTransform}
              showGuides
              onLayerClick={(layer) => setSelectedLayerId(layer.id)}
              selectedLayerId={selectedLayerId}
              onDragStart={startDrag}
              onResizeRotateStart={startResizeAndRotate}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={addLayer}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Text Block
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={downloadPng}>
              <Download className="mr-1.5 h-4 w-4" />
              Download PNG
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={undo}>
              <Undo2 className="mr-1 h-4 w-4" /> Undo
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={redo}>
              <Redo2 className="mr-1 h-4 w-4" /> Redo
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={syncScriptFromLayers}>
              <Sparkles className="mr-1 h-4 w-4" /> Sync Script
            </Button>
          </div>

          {/* Background Controls */}
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Background</p>
            {hideBackgroundUpload && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                ⚠️ Background image here is for preview only. Actual images come from the Image Pool above.
              </p>
            )}
            
            {/* Image Transform Controls (only show if preview image is active) */}
            {previewBackgroundImage && (
              <div className="mb-3 pb-3 border-b border-border space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Image Adjustments</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Zoom: {((imageTransform.scale || 1.0) * 100).toFixed(0)}%</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.1"
                      value={imageTransform.scale || 1.0}
                      onChange={(e) => setImageTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Pan X: {Math.round((imageTransform.x || 0) / 10)}</span>
                    <input
                      type="range"
                      min="-500"
                      max="500"
                      step="10"
                      value={imageTransform.x || 0}
                      onChange={(e) => setImageTransform(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Pan Y: {Math.round((imageTransform.y || 0) / 10)}</span>
                    <input
                      type="range"
                      min="-500"
                      max="500"
                      step="10"
                      value={imageTransform.y || 0}
                      onChange={(e) => setImageTransform(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setImageTransform({ scale: 1.0, x: 0, y: 0 })}
                    className="w-full"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                <input
                  type="color"
                  value={layout.background?.color || '#0F1A2C'}
                  onChange={(e) => updateBackgroundColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-border"
                />
              </label>
              
              {!hideBackgroundUpload && (
                <div className="flex items-center gap-2">
                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleBackgroundUpload(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => bgInputRef.current?.click()}
                    disabled={isUploadingBg}
                  >
                    <ImageIcon className="mr-1.5 h-4 w-4" />
                    {isUploadingBg ? 'Uploading...' : layout.background?.image ? 'Change Image' : 'Add Image'}
                  </Button>
                  {layout.background?.image && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={removeBackgroundImage}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              
              {!hideBackgroundUpload && layout.background?.image && (
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  Image set
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Layers</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={copyLayerToClipboard} disabled={!activeLayer}>
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={pasteLayerFromClipboard}>
                  <Copy className="mr-1 h-4 w-4 rotate-180" /> Paste
                </Button>
              </div>
            </div>
            {orderedLayers.length === 0 && (
              <p className="text-sm text-muted-foreground">Add a text block to get started.</p>
            )}
            <div className="space-y-2">
              {orderedLayers.map((layer, idx) => (
                <div
                  key={layer.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    selectedLayerId === layer.id ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left font-medium"
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    {(layer.text || '').slice(0, 28) || `Layer ${idx + 1}`}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveLayer(layer.id, 'up')}
                      disabled={idx === 0}
                    >
                      <MoveUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => moveLayer(layer.id, 'down')}
                      disabled={idx === orderedLayers.length - 1}
                    >
                      <MoveDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLayer(layer.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeLayer && (
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Text
                </label>
                <textarea
                  value={activeLayer.text ?? ''}
                  onChange={(e) => updateTextLocal(activeLayer.id, e.target.value)}
                  onBlur={() => saveTextOnBlur(activeLayer.id)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Font
                  </span>
                  <select
                    value={activeLayer.fontFamily}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, {
                        fontFamily: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-border bg-muted/40 px-2 py-2 text-sm"
                  >
                    {FONT_OPTIONS.map((option) => (
                      <option key={option.label} value={option.fontFamily}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Weight
                  </span>
                  <select
                    value={activeLayer.fontWeight}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, { fontWeight: e.target.value })
                    }
                    className="w-full rounded-md border border-border bg-muted/40 px-2 py-2 text-sm"
                  >
                    {/* Map labels to visual thickness in TikTok Sans */}
                    <option value="400">Normal</option>
                    <option value="500">Regular (TikTok default)</option>
                    <option value="600">Semi-bold</option>
                    <option value="700">Bold</option>
                    <option value="800">Extra Bold</option>
                    <option value="900">Black</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Opacity
                  </span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={activeLayer.opacity}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, { opacity: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Size (scale)
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={3}
                    step={0.1}
                    value={activeLayer.scale?.x ?? 1}
                    onChange={(e) => {
                      const s = Number(e.target.value)
                      updateLayer(activeLayer.id, { scale: { x: s, y: s } })
                    }}
                    className="w-full"
                  />
                  <span className="text-xs text-muted-foreground">
                    {Math.round((activeLayer.scale?.x ?? 1) * 100)}%
                  </span>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Text Color
                  </span>
                  <input
                    type="color"
                    value={activeLayer.color}
                    onChange={(e) => updateLayer(activeLayer.id, { color: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-md border border-border bg-muted/40"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Background
                  </span>
                  <input
                    type="color"
                    value={activeLayer.background || '#000000'}
                    onChange={(e) => updateLayer(activeLayer.id, { background: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-md border border-border bg-muted/40"
                  />
                </label>
              </div>

              {/* Style Presets - TikTok Native */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Style Preset
                </span>
                <div className="flex flex-wrap gap-2">
                  {STYLE_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant={activeLayer.preset === preset.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const updated = preset.apply(activeLayer)
                        updateLayer(activeLayer.id, updated)
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Stroke/Outline Controls */}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Stroke Color
                  </span>
                  <input
                    type="color"
                    value={activeLayer.strokeColor || '#000000'}
                    onChange={(e) => updateLayer(activeLayer.id, { strokeColor: e.target.value, preset: 'custom' })}
                    className="h-10 w-full cursor-pointer rounded-md border border-border bg-muted/40"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Stroke Width
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={activeLayer.strokeWidth || 0}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, { strokeWidth: Number(e.target.value), preset: 'custom' })
                    }
                    className="w-full"
                  />
                  <span className="text-xs text-muted-foreground">{activeLayer.strokeWidth || 0}px</span>
                </label>
              </div>

              {/* Shadow Controls */}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Shadow Color
                  </span>
                  <input
                    type="color"
                    value={activeLayer.shadowColor?.replace(/rgba?\([^)]+\)/, '#000000') || '#000000'}
                    onChange={(e) => updateLayer(activeLayer.id, { shadowColor: e.target.value, preset: 'custom' })}
                    className="h-10 w-full cursor-pointer rounded-md border border-border bg-muted/40"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Shadow Blur
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={activeLayer.shadowBlur || 0}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, { shadowBlur: Number(e.target.value), preset: 'custom' })
                    }
                    className="w-full"
                  />
                  <span className="text-xs text-muted-foreground">{activeLayer.shadowBlur || 0}px</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={activeLayer.align === 'left' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateLayer(activeLayer.id, { align: 'left' })}
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={activeLayer.align === 'center' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateLayer(activeLayer.id, { align: 'center' })}
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={activeLayer.align === 'right' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateLayer(activeLayer.id, { align: 'right' })}
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Start (ms)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={activeLayer.startMs ?? 0}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, { startMs: Number(e.target.value) })
                    }
                    className="w-full rounded-md border border-border bg-muted/40 px-2 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    End (ms)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={activeLayer.endMs ?? 6000}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, { endMs: Number(e.target.value) })
                    }
                    className="w-full rounded-md border border-border bg-muted/40 px-2 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

