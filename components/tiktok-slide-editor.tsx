'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text as KonvaText, Transformer, Line, Group, Image as KonvaImage } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
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

// Hook to load image for Konva
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

const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920
const VIEWPORT_WIDTH = 360
const SCALE = VIEWPORT_WIDTH / CANVAS_WIDTH
const VIEWPORT_HEIGHT = CANVAS_HEIGHT * SCALE
const CLIPBOARD_KEY = 'hayattime-layer-clipboard'

const defaultLayoutConfig = (): SlideLayoutConfig => ({
  version: 1,
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  safeZone: { top: 180, bottom: 220 },
  background: { color: '#0F1A2C' },
  layers: [],
})

const defaultLayer = (text: string): SlideTextLayer => ({
  id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  type: 'text',
  text,
  fontFamily: '"Inter", "Arial Rounded MT Bold", sans-serif',
  fontWeight: '700',
  fontSize: 72,
  color: '#ffffff',
  background: 'rgba(0,0,0,0.35)',
  align: 'center',
  position: { x: CANVAS_WIDTH / 2 - 240, y: CANVAS_HEIGHT / 2 - 120 },
  size: { width: 480, height: 240 },
  rotation: 0,
  scale: { x: 1, y: 1 },
  opacity: 1,
  zIndex: 0,
  startMs: 0,
  endMs: 6000,
})

const FONT_OPTIONS = [
  { label: 'Bold Sans', fontFamily: '"Inter", sans-serif', fontWeight: '700' },
  { label: 'Regular Sans', fontFamily: '"Inter", sans-serif', fontWeight: '500' },
  { label: 'Serif Accent', fontFamily: '"Times New Roman", serif', fontWeight: '700' },
]

interface TiktokSlideEditorProps {
  variantId: string
  variantLabel: string
  content: string
  layoutConfig?: SlideLayoutConfig
  onContentChange: (content: string) => void
  onLayoutChange: (config: SlideLayoutConfig) => void
}

export function TiktokSlideEditor({
  variantId,
  variantLabel,
  content,
  layoutConfig,
  onContentChange,
  onLayoutChange,
}: TiktokSlideEditorProps) {
  const normalizedLayout = useMemo(() => {
    const incoming = layoutConfig || defaultLayoutConfig()
    return {
      ...incoming,
      canvas: incoming.canvas || { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      safeZone: incoming.safeZone || { top: 180, bottom: 220 },
      background: incoming.background || { color: '#0F1A2C' },
      layers: (incoming.layers || []).map((layer, idx) => ({
        ...layer,
        zIndex: typeof layer.zIndex === 'number' ? layer.zIndex : idx,
      })),
    }
  }, [layoutConfig])

  const [layout, setLayout] = useState<SlideLayoutConfig>(normalizedLayout)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    normalizedLayout.layers.at(-1)?.id ?? null
  )
  const [isUploadingBg, setIsUploadingBg] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)
  const transformerRef = useRef<any>(null)
  const layerRefs = useRef<Record<string, any>>({})
  const historyRef = useRef<SlideLayoutConfig[]>([normalizedLayout])
  const historyIndexRef = useRef(0)
  const variantRef = useRef(variantId)
  const bgInputRef = useRef<HTMLInputElement>(null)
  
  // Load background image for Konva canvas
  const backgroundImage = useKonvaImage(layout.background?.image)

  useEffect(() => {
    const variantChanged = variantRef.current !== variantId
    variantRef.current = variantId

    const shouldSkip =
      !variantChanged &&
      Boolean(layout.lastModifiedAt) &&
      Boolean(normalizedLayout.lastModifiedAt) &&
      layout.lastModifiedAt === normalizedLayout.lastModifiedAt

    if (shouldSkip) {
      return
    }

    setLayout(normalizedLayout)
    historyRef.current = [normalizedLayout]
    historyIndexRef.current = 0
    setSelectedLayerId(normalizedLayout.layers.at(-1)?.id ?? null)
  }, [normalizedLayout, variantId, layout.lastModifiedAt])

  useEffect(() => {
    if (selectedLayerId && !layout.layers.find((layer) => layer.id === selectedLayerId)) {
      setSelectedLayerId(layout.layers.at(-1)?.id ?? null)
    }
  }, [layout.layers, selectedLayerId])

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return

    if (selectedLayerId && layerRefs.current[selectedLayerId]) {
      transformer.nodes([layerRefs.current[selectedLayerId]])
    } else {
      transformer.nodes([])
    }
    transformer.getLayer()?.batchDraw()
  }, [selectedLayerId, layout.layers])

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
        onLayoutChange(stamped)
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
    onLayoutChange(snapshot)
  }, [onLayoutChange])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    const snapshot = historyRef.current[historyIndexRef.current]
    setLayout(snapshot)
    onLayoutChange(snapshot)
  }, [onLayoutChange])

  const orderedLayers = useMemo(
    () => [...layout.layers].sort((a, b) => a.zIndex - b.zIndex),
    [layout.layers]
  )

  const activeLayer = orderedLayers.find((layer) => layer.id === selectedLayerId) || null

  const addLayer = () => {
    const nextLayer = defaultLayer(`Text ${layout.layers.length + 1}`)
    commitLayout((prev) => ({
      ...prev,
      layers: [...prev.layers, { ...nextLayer, zIndex: prev.layers.length }],
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

  const snapPosition = (value: number, size: number, full: number) => {
    const center = (full - size) / 2
    if (Math.abs(value - center) < 16) return center
    return value
  }

  const handleLayerDragEnd = (
    layerId: string,
    evt: KonvaEventObject<DragEvent>
  ) => {
    const rawX = evt.target.x() / SCALE
    const rawY = evt.target.y() / SCALE
    commitLayout((prev) => {
      const layer = prev.layers.find((l) => l.id === layerId)
      if (!layer) return prev
      return {
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === layerId
            ? {
                ...l,
                position: {
                  x: snapPosition(rawX, l.size.width, CANVAS_WIDTH),
                  y: snapPosition(rawY, l.size.height, CANVAS_HEIGHT),
                },
              }
            : l
        ),
      }
    })
  }

  const handleTransformEnd = (layerId: string) => {
    const node = layerRefs.current[layerId]
    if (!node) return
    const scaledWidth = (node.width() * node.scaleX()) / SCALE
    const scaledHeight = (node.height() * node.scaleY()) / SCALE
    const newX = node.x() / SCALE
    const newY = node.y() / SCALE
    node.scaleX(1)
    node.scaleY(1)
    commitLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              size: { width: scaledWidth, height: scaledHeight },
              position: { x: newX, y: newY },
              rotation: node.rotation(),
            }
          : layer
      ),
    }))
  }

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
          x: Math.min(layer.position.x + 32, CANVAS_WIDTH - layer.size.width),
          y: Math.min(layer.position.y + 32, CANVAS_HEIGHT - layer.size.height),
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
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedLayerId) {
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
      pixelRatio: CANVAS_WIDTH / VIEWPORT_WIDTH,
      backgroundColor: layout.background?.color || '#0F1A2C',
    })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${variantLabel || 'slide'}.png`
    link.click()
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px),1fr]">
        <div>
          <div
            ref={downloadRef}
            className="relative mx-auto aspect-[9/16] w-[360px] overflow-hidden rounded-[28px] border border-border bg-[#030711]"
          >
            <Stage width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT}>
              <Layer>
                <Rect
                  width={VIEWPORT_WIDTH}
                  height={VIEWPORT_HEIGHT}
                  fill={layout.background?.color || '#0F1A2C'}
                />
                {backgroundImage && (
                  <KonvaImage
                    image={backgroundImage}
                    width={VIEWPORT_WIDTH}
                    height={VIEWPORT_HEIGHT}
                    opacity={0.9}
                  />
                )}
                <Rect
                  y={layout.safeZone.top * SCALE}
                  width={VIEWPORT_WIDTH}
                  height={
                    VIEWPORT_HEIGHT - (layout.safeZone.top + layout.safeZone.bottom) * SCALE
                  }
                  stroke="rgba(255,255,255,0.12)"
                  dash={[12, 8]}
                  cornerRadius={24 * SCALE}
                />
                <Line
                  points={[VIEWPORT_WIDTH / 2, 0, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT]}
                  stroke="rgba(255,255,255,0.05)"
                  dash={[8, 8]}
                />
                <Line
                  points={[0, VIEWPORT_HEIGHT / 2, VIEWPORT_WIDTH, VIEWPORT_HEIGHT / 2]}
                  stroke="rgba(255,255,255,0.05)"
                  dash={[8, 8]}
                />
              </Layer>
              <Layer>
                {orderedLayers.map((layer) => (
                  <Group
                    key={layer.id}
                    ref={(node) => {
                      if (node) {
                        layerRefs.current[layer.id] = node
                      }
                    }}
                    x={layer.position.x * SCALE}
                    y={layer.position.y * SCALE}
                    draggable
                    rotation={layer.rotation}
                    opacity={layer.opacity}
                    onClick={(e) => {
                      e.cancelBubble = true
                      setSelectedLayerId(layer.id)
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true
                      setSelectedLayerId(layer.id)
                    }}
                    onDragEnd={(evt) => handleLayerDragEnd(layer.id, evt)}
                    onTransformEnd={() => handleTransformEnd(layer.id)}
                  >
                    <Rect
                      width={layer.size.width * SCALE}
                      height={layer.size.height * SCALE}
                      fill={layer.background || 'transparent'}
                      cornerRadius={24 * SCALE}
                    />
                    <KonvaText
                      text={layer.text}
                      width={layer.size.width * SCALE}
                      height={layer.size.height * SCALE}
                      fontSize={layer.fontSize * SCALE}
                      fontFamily={layer.fontFamily}
                      fontStyle={layer.fontWeight}
                      fill={layer.color}
                      align={layer.align}
                      padding={12 * SCALE}
                      wrap="word"
                    />
                  </Group>
                ))}
                <Transformer
                  ref={transformerRef}
                  rotateEnabled
                  enabledAnchors={[
                    'top-left',
                    'top-right',
                    'bottom-left',
                    'bottom-right',
                    'top-center',
                    'bottom-center',
                  ]}
                  borderStroke="#E0C88C"
                  anchorFill="#E0C88C"
                  anchorStroke="#0F1A2C"
                  anchorSize={6}
                />
              </Layer>
            </Stage>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={addLayer}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Text Block
            </Button>
            <Button size="sm" variant="outline" onClick={downloadPng}>
              <Download className="mr-1.5 h-4 w-4" />
              Download PNG
            </Button>
            <Button size="sm" variant="ghost" onClick={undo}>
              <Undo2 className="mr-1 h-4 w-4" /> Undo
            </Button>
            <Button size="sm" variant="ghost" onClick={redo}>
              <Redo2 className="mr-1 h-4 w-4" /> Redo
            </Button>
            <Button size="sm" variant="ghost" onClick={syncScriptFromLayers}>
              <Sparkles className="mr-1 h-4 w-4" /> Sync Script
            </Button>
          </div>

          {/* Background Controls */}
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Background</p>
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
              
              {layout.background?.image && (
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
                <Button size="sm" variant="ghost" onClick={copyLayerToClipboard} disabled={!activeLayer}>
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </Button>
                <Button size="sm" variant="ghost" onClick={pasteLayerFromClipboard}>
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
                    {layer.text.slice(0, 28) || `Layer ${idx + 1}`}
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
                  value={activeLayer.text}
                  onChange={(e) => updateLayer(activeLayer.id, { text: e.target.value })}
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
                    <option value="400">Regular</option>
                    <option value="600">Semi-bold</option>
                    <option value="700">Bold</option>
                    <option value="800">Extra Bold</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Font Size
                  </span>
                  <input
                    type="number"
                    min={24}
                    max={200}
                    value={activeLayer.fontSize}
                    onChange={(e) =>
                      updateLayer(activeLayer.id, { fontSize: Number(e.target.value) })
                    }
                    className="w-full rounded-md border border-border bg-muted/40 px-2 py-2 text-sm"
                  />
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
}

