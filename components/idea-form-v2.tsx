'use client'

import { useMemo, useState, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PERSONAS, COUNTRIES, PERSONA_LABELS, COUNTRY_LABELS } from '@/lib/constants'
import { Plus, Trash2, Upload, Image as ImageIcon, X, Check, Sparkles } from 'lucide-react'
import { TiktokSlideEditor, type TiktokSlideEditorHandle } from '@/components/tiktok-slide-editor'
import type { 
  IdeaWithDetailsV2, 
  Persona, 
  Country, 
  SlideLayoutConfig,
  SlideTextLayer,
  ImageSlot,
} from '@/types'

const SLIDE_TYPE_OPTIONS = [
  { value: 'hook', label: 'Hook', slot: 'hook' as ImageSlot, recommendedImages: 4 },
  { value: 'problem', label: 'Problem', slot: 'body' as ImageSlot, recommendedImages: 2 },
  { value: 'agitation', label: 'Agitation', slot: 'body' as ImageSlot, recommendedImages: 2 },
  { value: 'solution', label: 'Solution', slot: 'body' as ImageSlot, recommendedImages: 2 },
  { value: 'benefit', label: 'Benefit', slot: 'body' as ImageSlot, recommendedImages: 2 },
  { value: 'proof', label: 'Proof', slot: 'body' as ImageSlot, recommendedImages: 2 },
  { value: 'cta', label: 'Call to Action', slot: 'body' as ImageSlot, recommendedImages: 2 },
]

// ============================================
// V2 State Types
// ============================================

// Text content for a specific country+variant
// Each entry maps layer ID to text content
type CountryTextVariant = {
  country: Country
  variant_index: 1 | 2
  layerTexts: Record<string, string> // layerId -> text content
}

type ImagePoolEntry = {
  id: string
  slot: ImageSlot
  storage_path: string
  variant_label: string
  previewUrl?: string
}

type SlideStateV2 = {
  id: string
  slide_number: number
  slide_type: string
  slot: ImageSlot
  recommendedImages: number
  title: string
  // ONE shared layout config for all countries/variants
  layoutConfig: SlideLayoutConfig
  // Text content per country+variant
  textVariants: CountryTextVariant[]
  imagePool: ImagePoolEntry[]
}

type PersonaStateV2 = {
  persona_type: Persona
  active: boolean
  slides: SlideStateV2[]
}

// ============================================
// Helpers
// ============================================

const randomId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const createLayoutConfig = (aspectRatio: import('@/types').AspectRatio = '9:16'): SlideLayoutConfig => {
  const canvas = aspectRatio === '3:4' 
    ? { width: 1080, height: 1440 }
    : { width: 1080, height: 1920 }
  
  return {
    version: 1,
    canvas,
    safeZone: { top: 180, bottom: 220 },
    background: { color: '#0F1A2C' },
    layers: [],
  }
}

const createAllTextVariants = (): CountryTextVariant[] => {
  const variants: CountryTextVariant[] = []
  for (const country of COUNTRIES) {
    for (const variant_index of [1, 2] as const) {
      variants.push({
        country,
        variant_index,
        layerTexts: {}, // Will be populated as layers are added
      })
    }
  }
  return variants
}

// Auto-determine slot and recommended images based on slide position
const getSlideConfig = (slideNumber: number) => {
  // Slide 1 is always hook (4 images)
  if (slideNumber === 1) {
    return { slot: 'hook' as ImageSlot, recommendedImages: 4, slideType: 'hook' }
  }
  // All other slides are body (2 images)
  const slideType = SLIDE_TYPE_OPTIONS[Math.min(slideNumber - 1, SLIDE_TYPE_OPTIONS.length - 1)]
  return {
    slot: 'body' as ImageSlot,
    recommendedImages: 2,
    slideType: slideType.value,
  }
}

const createSlideV2 = (position: number, aspectRatio: import('@/types').AspectRatio = '9:16'): SlideStateV2 => {
  const config = getSlideConfig(position)
  return {
    id: randomId(),
    slide_number: position,
    slide_type: config.slideType,
    slot: config.slot,
    recommendedImages: config.recommendedImages,
    title: '',
    layoutConfig: createLayoutConfig(aspectRatio), // ONE shared layout per slide
    textVariants: createAllTextVariants(),
    imagePool: [],
  }
}

const createDefaultSlides = (aspectRatio: import('@/types').AspectRatio = '9:16'): SlideStateV2[] => {
  return SLIDE_TYPE_OPTIONS.map((opt, idx) => ({
    id: randomId(),
    slide_number: idx + 1,
    slide_type: opt.value,
    slot: opt.slot,
    recommendedImages: opt.recommendedImages,
    title: '',
    layoutConfig: createLayoutConfig(aspectRatio),
    textVariants: createAllTextVariants(),
    imagePool: [],
  }))
}

// ============================================
// Component
// ============================================

interface IdeaFormV2Props {
  mode: 'create' | 'edit'
  ideaId?: string
  initialIdea?: IdeaWithDetailsV2
}

export function IdeaFormV2({ mode, ideaId, initialIdea }: IdeaFormV2Props) {
  const [title, setTitle] = useState(initialIdea?.title || '')
  const [category, setCategory] = useState(initialIdea?.category || '')
  const [description, setDescription] = useState(initialIdea?.description || '')
  const [aspectRatio, setAspectRatio] = useState<import('@/types').AspectRatio>(initialIdea?.aspect_ratio || '9:16')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<TiktokSlideEditorHandle>(null)

  const basePersonas = useMemo<PersonaStateV2[]>(() => {
    return PERSONAS.map((persona) => {
      const personaDetails = initialIdea?.personas?.find(
        (p) => p.persona_type === persona
      )
      const active = Boolean(personaDetails) || persona === 'main'

      let slides: SlideStateV2[] = []
      if (personaDetails?.slides?.length) {
        slides = personaDetails.slides.map((slide) => {
          // Auto-determine slot based on slide_number
          const config = getSlideConfig(slide.slide_number)

          // Extract layout config from first text pool entry that has one
          // All variants share the same layout structure (position, size, styling), only text differs
          let sharedLayoutConfig: SlideLayoutConfig = createLayoutConfig()
          const firstTextPool = slide.text_pools?.find((t) => t.layout_config)
          if (firstTextPool?.layout_config) {
            const firstLayout = firstTextPool.layout_config as SlideLayoutConfig
            // Extract layout structure without text (text is per-variant)
            sharedLayoutConfig = {
              ...firstLayout,
              layers: firstLayout.layers?.map((layer) => ({
                ...layer,
                text: '', // Clear text, will be populated per variant
              })) || [],
            }
          }

          // Extract layer texts from each variant's layout_config
          const textVariants: CountryTextVariant[] = []
          for (const country of COUNTRIES) {
            for (const variant_index of [1, 2] as const) {
              const existing = slide.text_pools?.find(
                (t) => t.country === country && t.variant_index === variant_index
              )
              
              const layerTexts: Record<string, string> = {}
              
              if (existing?.layout_config) {
                // Extract text from this variant's layout config layers
                const variantLayout = existing.layout_config as SlideLayoutConfig
                if (variantLayout.layers?.length > 0) {
                  variantLayout.layers.forEach((layer) => {
                    if (layer.text) {
                      layerTexts[layer.id] = layer.text
                    }
                  })
                }
              }
              
              // Fallback: if no layers but we have content string, put it in first layer
              if (Object.keys(layerTexts).length === 0 && existing?.content && sharedLayoutConfig.layers?.length > 0) {
                layerTexts[sharedLayoutConfig.layers[0].id] = existing.content
              } else if (Object.keys(layerTexts).length === 0 && existing?.content) {
                // No layers yet, use default ID
                layerTexts['default'] = existing.content
              }
              
              textVariants.push({
                country,
                variant_index,
                layerTexts,
              })
            }
          }

          const imagePool: ImagePoolEntry[] = (slide.image_pools || []).map((img) => {
            // Try to get URL from metadata first, otherwise construct from storage_path
            // The URL should already be constructed server-side, but if not, we'll handle it client-side
            let previewUrl = img.metadata?.publicUrl
            
            // If no URL in metadata but we have storage_path, construct it
            if (!previewUrl && img.storage_path) {
              // This will be handled by the server-side data fetching
              // For now, we'll construct it if we have the storage path
              // Note: NEXT_PUBLIC_ vars ARE available in client components
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
              const bucket = process.env.NEXT_PUBLIC_SLIDE_ASSETS_BUCKET || 'slide-assets'
              if (supabaseUrl) {
                previewUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${img.storage_path}`
              }
            }
            
            return {
              id: img.id,
              slot: img.slot as ImageSlot,
              storage_path: img.storage_path,
              variant_label: img.variant_label || '',
              previewUrl,
              transform: img.transform, // Load saved transform settings
            }
          })

          return {
            id: slide.id,
            slide_number: slide.slide_number,
            slide_type: config.slideType, // Use auto-determined type
            slot: config.slot,
            recommendedImages: config.recommendedImages,
            title: slide.title || '',
            layoutConfig: sharedLayoutConfig, // ONE shared layout
            textVariants,
            imagePool,
          }
        })
      }

      if (slides.length === 0) {
        const ideaAspectRatio = initialIdea?.aspect_ratio || '9:16'
        slides = createDefaultSlides(ideaAspectRatio)
      }

      return {
        persona_type: persona,
        active,
        slides,
      }
    })
  }, [initialIdea])

  const [personas, setPersonas] = useState<PersonaStateV2[]>(basePersonas)
  const [activePersona, setActivePersona] = useState<Persona>(
    () => basePersonas.find((p) => p.active)?.persona_type || 'main'
  )
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [activeCountry, setActiveCountry] = useState<Country>('uk')
  const [activeVariantIndex, setActiveVariantIndex] = useState<1 | 2>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null)
  // Track which image is selected for preview per slide
  const [selectedPreviewImageId, setSelectedPreviewImageId] = useState<Record<string, string>>({})

  const activePersonaData = personas.find((p) => p.persona_type === activePersona)!
  const activeSlide = activePersonaData?.slides[activeSlideIndex]
  const activeTextVariant = activeSlide?.textVariants.find(
    (t) => t.country === activeCountry && t.variant_index === activeVariantIndex
  )
  
  // Get current variant's text content for all layers
  // When in editor mode, we populate layers with text from the active variant
  const getActiveVariantLayerTexts = (): Record<string, string> => {
    return activeTextVariant?.layerTexts || {}
  }
  
  // Get layout config with text from active variant populated into layers
  // Memoized to prevent creating new objects on every render (which could cause editor resets)
  const layoutConfigForEditor = useMemo(() => {
    const baseConfig = activeSlide?.layoutConfig || createLayoutConfig(aspectRatio)
    // Ensure canvas matches current aspect ratio (always use current selection)
    const canvasDimensions = aspectRatio === '3:4' 
      ? { width: 1080, height: 1440 }
      : { width: 1080, height: 1920 }
    
    const layerTexts = getActiveVariantLayerTexts()
    
    return {
      ...baseConfig,
      canvas: canvasDimensions, // Always use current aspect ratio
      layers: baseConfig.layers.map((layer) => ({
        ...layer,
        text: layerTexts[layer.id] || layer.text || '',
      })),
    }
  }, [activeSlide?.layoutConfig, aspectRatio, activeCountry, activeVariantIndex, activeTextVariant?.layerTexts]) // Only recalc when these change
  
  // Get selected image from pool for preview (or first if none selected)
  const getPreviewBackgroundImage = (): { url?: string; imageId?: string; transform?: import('@/types').ImageTransform } => {
    if (!activeSlide || activeSlide.imagePool.length === 0) return {}
    
    const selectedId = selectedPreviewImageId[activeSlide.id] || activeSlide.imagePool[0]?.id
    const selectedImage = activeSlide.imagePool.find(img => img.id === selectedId) || activeSlide.imagePool[0]
    
    return {
      url: selectedImage.previewUrl,
      imageId: selectedImage.id,
      transform: (selectedImage as any)?.transform,
    }
  }

  // ============================================
  // State Updates
  // ============================================

  const updatePersonas = (updater: (prev: PersonaStateV2[]) => PersonaStateV2[]) => {
    setPersonas((prev) => updater(prev))
  }

  const updateSlide = (
    personaType: Persona,
    slideIndex: number,
    updater: (slide: SlideStateV2) => SlideStateV2
  ) => {
    updatePersonas((prev) =>
      prev.map((persona) =>
        persona.persona_type === personaType
          ? {
              ...persona,
              slides: persona.slides.map((slide, idx) =>
                idx === slideIndex ? updater(slide) : slide
              ),
            }
          : persona
      )
    )
  }

  // Update the shared layout config (affects all variants)
  const updateLayoutConfig = (
    personaType: Persona,
    slideIndex: number,
    newLayout: SlideLayoutConfig
  ) => {
    updateSlide(personaType, slideIndex, (slide) => ({
      ...slide,
      layoutConfig: newLayout,
    }))
  }
  
  // Update layer texts for a specific country+variant
  const updateLayerTexts = (
    personaType: Persona,
    slideIndex: number,
    country: Country,
    variantIndex: 1 | 2,
    layerTexts: Record<string, string>
  ) => {
    updateSlide(personaType, slideIndex, (slide) => ({
      ...slide,
      textVariants: slide.textVariants.map((v) =>
        v.country === country && v.variant_index === variantIndex
          ? { ...v, layerTexts }
          : v
      ),
    }))
  }
  
  const updateTextVariant = (
    personaType: Persona,
    slideIndex: number,
    country: Country,
    variantIndex: 1 | 2,
    changes: Partial<CountryTextVariant>
  ) => {
    updateSlide(personaType, slideIndex, (slide) => ({
      ...slide,
      textVariants: slide.textVariants.map((v) =>
        v.country === country && v.variant_index === variantIndex
          ? { ...v, ...changes }
          : v
      ),
    }))
  }
  
  // Update parent state when layout changes (so it persists when switching tabs)
  // BUT: This does NOT trigger a server save - only the explicit save button does that
  const handleLayoutChange = (newLayout: SlideLayoutConfig) => {
    if (!activeSlide) return
    
    // Extract text from layers for the active variant
    const layerTexts: Record<string, string> = {}
    newLayout.layers.forEach((layer) => {
      if (layer.text) {
        layerTexts[layer.id] = layer.text
      }
    })
    
    // Create layout without text (structure only) for sharing
    const sharedLayout: SlideLayoutConfig = {
      ...newLayout,
      layers: newLayout.layers.map((layer) => ({
        ...layer,
        text: '', // Remove text - text is per-variant
      })),
    }
    
    // Update shared layout (structure only) - this updates local React state only
    updateLayoutConfig(activePersona, activeSlideIndex, sharedLayout)
    
    // Update this variant's layer texts - also local React state only
    updateLayerTexts(
      activePersona,
      activeSlideIndex,
      activeCountry,
      activeVariantIndex,
      layerTexts
    )
    
    // NO SERVER SAVE - only updates local state so changes persist when switching tabs
  }

  const togglePersona = (personaType: Persona) => {
    updatePersonas((prev) =>
      prev.map((persona) =>
        persona.persona_type === personaType
          ? { ...persona, active: !persona.active }
          : persona
      )
    )
    const target = personas.find((p) => p.persona_type === personaType)
    if (target && !target.active) {
      setActivePersona(personaType)
    }
  }

  const addSlide = (personaType: Persona) => {
    updatePersonas((prev) =>
      prev.map((persona) => {
        if (persona.persona_type !== personaType) return persona
        const newSlide = createSlideV2(persona.slides.length + 1, aspectRatio)
        return {
          ...persona,
          slides: [...persona.slides, newSlide],
        }
      })
    )
  }

  const removeSlide = (personaType: Persona, slideIndex: number) => {
    updatePersonas((prev) =>
      prev.map((persona) => {
        if (persona.persona_type !== personaType) return persona
        const slides = persona.slides.filter((_, idx) => idx !== slideIndex)
        return {
          ...persona,
          slides: slides.map((s, idx) => {
            const newNumber = idx + 1
            const config = getSlideConfig(newNumber)
            return {
              ...s,
              slide_number: newNumber,
              slot: config.slot,
              recommendedImages: config.recommendedImages,
              slide_type: config.slideType,
            }
          }),
        }
      })
    )
    if (activeSlideIndex >= activePersonaData.slides.length - 1) {
      setActiveSlideIndex(Math.max(0, activeSlideIndex - 1))
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    const slide = activeSlide
    if (!slide) return

    setUploadingSlideId(slide.id)

    try {
      // Upload multiple files
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('ideaId', ideaId || 'new-idea')
        formData.append('persona', activePersona)
        formData.append('slide', slide.id)
        formData.append('slot', slide.slot)

        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to upload image')
        }

        const data = await response.json()
        
        updateSlide(activePersona, activeSlideIndex, (s) => ({
          ...s,
          imagePool: [
            ...s.imagePool,
            {
              id: randomId(),
              slot: s.slot,
              storage_path: data.path,
              variant_label: `Image ${s.imagePool.length + 1}`,
              previewUrl: data.url,
            },
          ],
        }))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload image')
    } finally {
      setUploadingSlideId(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeImageFromPool = (
    personaType: Persona,
    slideIndex: number,
    imageId: string
  ) => {
    updateSlide(personaType, slideIndex, (slide) => ({
      ...slide,
      imagePool: slide.imagePool.filter((img) => img.id !== imageId),
    }))
  }

  // ============================================
  // Submit
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const activePersonas = personas.filter((p) => p.active)
      if (activePersonas.length === 0) {
        throw new Error('Please activate at least one persona')
      }

      const personasPayload = activePersonas.map((persona) => ({
        persona_type: persona.persona_type,
        slides: persona.slides.map((slide, slideIndex) => {
          // Wrapped text from editor (only for the slide currently being edited) so backend matches front-end line breaks
          const isCurrentlyEditedSlide =
            persona.persona_type === activePersonaData?.persona_type && slideIndex === activeSlideIndex
          const wrappedByLayer =
            isCurrentlyEditedSlide && editorRef.current
              ? editorRef.current.getWrappedTextForLayers()
              : {}
          // Store layout config with text populated for each variant
          // All variants share the same layout structure, but text differs
          const textPools = slide.textVariants
            .filter((v) => Object.values(v.layerTexts || {}).some((text) => text.trim()))
            .map((v) => {
              // Create layout config with text populated from this variant's layer texts
              const layoutWithText: SlideLayoutConfig = {
                ...slide.layoutConfig,
                layers: slide.layoutConfig.layers.map((layer) => ({
                  ...layer,
                  text: v.layerTexts[layer.id] || layer.text || '',
                  wrappedText: wrappedByLayer[layer.id] ?? layer.wrappedText,
                })),
              }
              
              // Combine layer texts for content field (for backward compatibility)
              const combinedContent = slide.layoutConfig.layers
                .map((layer) => v.layerTexts[layer.id] || '')
                .filter((text) => text.trim())
                .join('\n')
              
              return {
                country: v.country,
                variant_index: v.variant_index,
                content: combinedContent || '', // Fallback combined content
                layout_config: layoutWithText, // Layout with this variant's text populated
              }
            })
          
          return {
            slide_number: slide.slide_number,
            slide_type: slide.slide_type,
            title: slide.title || undefined,
            text_pools: textPools,
            image_pools: slide.imagePool.map((img) => ({
              slot: slide.slot,
              storage_path: img.storage_path,
              variant_label: img.variant_label,
              transform: (img as any)?.transform, // Include crop/zoom/pan settings
            })),
          }
        }),
      }))

      const payload = {
        title,
        category,
        description: description || undefined,
        aspect_ratio: aspectRatio,
        personas: personasPayload,
      }

      const endpoint =
        mode === 'create' ? '/api/ideas/v2' : `/api/ideas/v2/${ideaId ?? ''}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save idea')
      }

      const { idea } = await response.json()
      const id = idea?.id || ideaId
      if (id) window.location.href = `/ideas/${id}`
    } catch (err: any) {
      setError(err.message || 'Failed to save idea')
      setIsSubmitting(false)
    }
  }

  // ============================================
  // Render
  // ============================================

  // Prevent accidental form submission (e.g., pressing Enter in input fields)
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement
      // Only allow Enter to submit if it's explicitly on the submit button
      // Block Enter in all input fields, textareas, etc.
      if (target instanceof HTMLInputElement || 
          target instanceof HTMLTextAreaElement ||
          target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4 border-b border-border pb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
            placeholder="Enter idea title"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              placeholder="e.g., Lifestyle"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Aspect Ratio *</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as import('@/types').AspectRatio)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            >
              <option value="9:16">9:16 (TikTok/Instagram Reels)</option>
              <option value="3:4">3:4 (Instagram Posts)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Applies to all slides in this idea
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* Persona Tabs */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Personas</h2>
        <div className="flex gap-2 flex-wrap">
          {PERSONAS.map((persona) => {
            const personaData = personas.find((p) => p.persona_type === persona)!
            const isActive = personaData.active
            const isCurrent = activePersona === persona
            return (
              <button
                key={persona}
                type="button"
                onClick={() => {
                  if (isActive) {
                    setActivePersona(persona)
                  } else {
                    togglePersona(persona)
                  }
                }}
                className={`px-4 py-2 rounded-md border transition-colors ${
                  isActive
                    ? isCurrent
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-primary/20 border-primary'
                    : 'bg-background border-border hover:bg-accent'
                }`}
              >
                {PERSONA_LABELS[persona]}
                {isActive && <span className="ml-2 text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Slide Editor */}
      {activePersonaData.active && (
        <div className="space-y-4 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold">
              Slides – {PERSONA_LABELS[activePersona]}
            </h3>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    let translated = 0
                    // Translate ALL slides for this persona, both KSA and Malaysia, all variants
                    for (let slideIdx = 0; slideIdx < activePersonaData.slides.length; slideIdx++) {
                      const slide = activePersonaData.slides[slideIdx]
                      for (const targetCountry of ['ksa', 'my'] as const) {
                        const targetLang = targetCountry === 'ksa' ? 'ar' : 'ms'
                        for (const variantIndex of [1, 2] as const) {
                          // Find UK text for this variant
                          const ukVariant = slide.textVariants.find(
                            v => v.country === 'uk' && v.variant_index === variantIndex
                          )
                          if (!ukVariant || Object.keys(ukVariant.layerTexts).length === 0) continue
                          
                          // Translate all layer texts
                          const translatedLayerTexts: Record<string, string> = {}
                          for (const [layerId, text] of Object.entries(ukVariant.layerTexts)) {
                            if (!text.trim()) continue
                            
                            const response = await fetch('/api/translate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ text, targetLang }),
                            })
                            
                            if (!response.ok) throw new Error('Translation failed')
                            
                            const data = await response.json()
                            translatedLayerTexts[layerId] = data.translatedText
                          }
                          
                          // Update this variant
                          updateLayerTexts(
                            activePersona,
                            slideIdx,
                            targetCountry,
                            variantIndex,
                            translatedLayerTexts
                          )
                          translated++
                        }
                      }
                    }
                    alert(`Translated ${translated} variants across all slides`)
                  } catch (err: any) {
                    alert(`Translation failed: ${err.message}`)
                  }
                }}
              >
                <Sparkles className="h-4 w-4 mr-1" /> Translate All Slides
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSlide(activePersona)}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Slide
              </Button>
            </div>
          </div>

          {/* Slide tabs */}
          <div className="flex gap-1 flex-wrap border-b border-border pb-2">
            {activePersonaData.slides.map((slide, idx) => {
              const hasImages = slide.imagePool.length > 0
              const hasText = slide.textVariants.some((v) => 
                Object.values(v.layerTexts || {}).some((text) => text?.trim())
              )
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`px-3 py-1.5 rounded-t text-sm transition-colors flex items-center gap-1 ${
                    idx === activeSlideIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-accent'
                  }`}
                >
                  {slide.slide_number}. {slide.slide_type}
                  {hasImages && <ImageIcon className="h-3 w-3" />}
                  {hasText && <Check className="h-3 w-3" />}
                </button>
              )
            })}
          </div>

          {activeSlide && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Images */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">
                      Image Pool ({activeSlide.slot === 'hook' ? 'Hook' : 'Body'})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Recommended: {activeSlide.recommendedImages} images for randomization
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      activeSlide.imagePool.length >= activeSlide.recommendedImages 
                        ? 'text-emerald-600' 
                        : 'text-amber-600'
                    }`}>
                      {activeSlide.imagePool.length}/{activeSlide.recommendedImages}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSlide(activePersona, activeSlideIndex)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Image Grid */}
                <div className="border border-border rounded-lg p-4 bg-muted/30 min-h-[200px]">
                  <div className="mb-2 text-xs text-muted-foreground">
                    Click an image to use it as preview in editor
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {activeSlide.imagePool.map((img, idx) => {
                      const isSelected = selectedPreviewImageId[activeSlide.id] === img.id || 
                                        (!selectedPreviewImageId[activeSlide.id] && idx === 0)
                      return (
                        <div
                          key={img.id}
                          className={`relative aspect-[9/16] rounded border-2 overflow-hidden group cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-primary ring-2 ring-primary/50' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedPreviewImageId(prev => ({
                            ...prev,
                            [activeSlide.id]: img.id
                          }))}
                        >
                          {img.previewUrl ? (
                            <img
                              src={img.previewUrl}
                              alt={img.variant_label}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded">
                              Preview
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeImageFromPool(activePersona, activeSlideIndex, img.id)
                            }}
                            className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })}
                    
                    {/* Upload Button */}
                    <label className={`aspect-[9/16] rounded border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      uploadingSlideId === activeSlide.id ? 'opacity-50' : ''
                    }`}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={uploadingSlideId === activeSlide.id}
                      />
                      <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">
                        {uploadingSlideId === activeSlide.id ? 'Uploading...' : 'Add Images'}
                      </span>
                    </label>
                  </div>
                </div>

              </div>

              {/* Right Column: Text */}
              <div className="space-y-4">
                <h4 className="font-medium">
                  Text Content (2 versions per country)
                </h4>

                {/* Country tabs with translate button */}
                <div className="flex gap-1 border-b border-border pb-2 items-center">
                  {COUNTRIES.map((country) => {
                    const hasContent = activeSlide.textVariants.some(
                      (v) => v.country === country && Object.values(v.layerTexts || {}).some((text) => text?.trim())
                    )
                    return (
                      <button
                        key={country}
                        type="button"
                        onClick={() => setActiveCountry(country)}
                        className={`px-3 py-1.5 rounded-t text-sm transition-colors flex items-center gap-1 ${
                          country === activeCountry
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-accent'
                        }`}
                      >
                        {COUNTRY_LABELS[country]}
                        {hasContent && <Check className="h-3 w-3" />}
                      </button>
                    )
                  })}
                  {(activeCountry === 'ksa' || activeCountry === 'my') && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={async () => {
                        if (!activeSlide) return
                        const targetLang = activeCountry === 'ksa' ? 'ar' : 'ms'
                        // Find UK text for this slide and variant
                        const ukVariant = activeSlide.textVariants.find(
                          v => v.country === 'uk' && v.variant_index === activeVariantIndex
                        )
                        if (!ukVariant || Object.keys(ukVariant.layerTexts).length === 0) {
                          alert('No UK text found to translate. Please fill UK text first.')
                          return
                        }
                        
                        try {
                          // Translate all layer texts via server-side API
                          const translatedLayerTexts: Record<string, string> = {}
                          for (const [layerId, text] of Object.entries(ukVariant.layerTexts)) {
                            if (!text.trim()) continue
                            
                            const response = await fetch('/api/translate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                text,
                                targetLang,
                              }),
                            })
                            
                            if (!response.ok) {
                              const data = await response.json()
                              throw new Error(data.error || 'Translation failed')
                            }
                            
                            const data = await response.json()
                            translatedLayerTexts[layerId] = data.translatedText
                          }
                          
                          // Update the current variant with translated text
                          updateLayerTexts(
                            activePersona,
                            activeSlideIndex,
                            activeCountry,
                            activeVariantIndex,
                            translatedLayerTexts
                          )
                        } catch (err: any) {
                          alert(`Translation failed: ${err.message}`)
                        }
                      }}
                    >
                      Translate from UK
                    </Button>
                  )}
                </div>

                {/* Variant tabs */}
                <div className="flex gap-1">
                  {([1, 2] as const).map((varIdx) => {
                    const variant = activeSlide.textVariants.find(
                      (v) => v.country === activeCountry && v.variant_index === varIdx
                    )
                    // Check if any layer has text content
                    const hasContent = Boolean(
                      variant && Object.values(variant.layerTexts || {}).some((text) => text.trim())
                    )
                    return (
                      <button
                        key={varIdx}
                        type="button"
                        onClick={() => setActiveVariantIndex(varIdx)}
                        className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${
                          varIdx === activeVariantIndex
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-muted hover:bg-accent'
                        }`}
                      >
                        Variant {varIdx}
                        {hasContent && <Check className="h-3 w-3" />}
                      </button>
                    )
                  })}
                </div>

                {/* TikTok Editor - Always visible, replaces text section */}
                {activeSlide ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Editing: {COUNTRY_LABELS[activeCountry]} - Variant {activeVariantIndex}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Layout shared • Text per variant
                      </p>
                    </div>
                    
                    {/* Editor with variant-specific text */}
                    <div className="border border-border rounded-lg bg-background overflow-hidden">
                      <div className="max-w-full overflow-x-auto">
                        <TiktokSlideEditor
                          ref={editorRef}
                          key={`${activeSlide.id}-${activeCountry}-${activeVariantIndex}`}
                          variantId={`${activeSlide.id}-${activeCountry}-${activeVariantIndex}`}
                          variantLabel={`${COUNTRY_LABELS[activeCountry]} Variant ${activeVariantIndex}`}
                          content={Object.values(getActiveVariantLayerTexts()).join('\n')}
                          layoutConfig={layoutConfigForEditor}
                          onContentChange={() => {
                            // Handled via layout changes
                          }}
                          onLayoutChange={handleLayoutChange}
                          hideBackgroundUpload={true}
                          compactLayout={true}
                          previewBackgroundImage={getPreviewBackgroundImage().url}
                          previewImageTransform={getPreviewBackgroundImage().transform}
                          previewImageId={getPreviewBackgroundImage().imageId}
                          aspectRatio={aspectRatio}
                          onImageTransformChange={(imageId, transform) => {
                          // Update transform for this image in the pool
                          updateSlide(activePersona, activeSlideIndex, (slide) => ({
                            ...slide,
                            imagePool: slide.imagePool.map(img => 
                              img.id === imageId 
                                ? { ...img, transform }
                                : img
                            ),
                          }))
                        }}
                      />
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg space-y-2">
                      <div>
                        <p className="font-medium mb-1">How it works:</p>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>Layout (position, size, styling) is shared for all 8 variants</li>
                          <li>Switch country/variant tabs above to edit different text content</li>
                          <li>Add multiple text layers using "Add Text Block" button</li>
                          <li>Each layer's text content differs per variant</li>
                        </ul>
                      </div>
                      <div className="border-t border-border pt-2 mt-2">
                        <p className="font-medium mb-1 text-amber-600 dark:text-amber-400">⚠️ Important:</p>
                        <p>• Background color in editor is used, but background images are NOT</p>
                        <p>• Images from the Image Pool above are randomly selected during generation</p>
                        <p>• Editor background image upload is disabled - use Image Pool instead</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a slide to edit</p>
                )}

                {/* Progress Summary */}
                <div className="border border-border rounded-lg p-3 bg-muted/30">
                  <p className="text-sm font-medium mb-2">Text Coverage</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {COUNTRIES.map((country) => {
                      const filled = activeSlide.textVariants.filter(
                        (v) => v.country === country && Object.values(v.layerTexts || {}).some((text) => text.trim())
                      ).length
                      return (
                        <div key={country} className="text-center">
                          <p className="font-medium">{COUNTRY_LABELS[country]}</p>
                          <p className={filled === 2 ? 'text-emerald-600' : 'text-amber-600'}>
                            {filled}/2
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-foreground mb-2">
          How Generation Works
        </h4>
        <ul className="text-sm text-foreground/90 space-y-1">
          <li>• Upload multiple images per slide for randomization (Hook: 4, Body: 2)</li>
          <li>• Add 2 text variants per country to maximize unique combinations</li>
          <li>• Generator creates 7 unique posts per country (28 total per persona)</li>
          <li>• Each post randomly picks images and text variants with no duplicates</li>
          <li>• Export downloads all posts as organized ZIP file</li>
        </ul>
      </div>

      {/* Submit */}
      <div className="flex gap-4 pt-4">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Updating...'
            : mode === 'create'
            ? 'Create Idea'
            : 'Update Idea'}
        </Button>
        <Link href={mode === 'create' ? '/ideas' : `/ideas/${ideaId}`}>
          <Button type="button" variant="outline" size="lg">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  )
}
