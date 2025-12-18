'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PERSONAS, COUNTRIES, PERSONA_LABELS, COUNTRY_LABELS } from '@/lib/constants'
import { TiktokSlideEditor } from '@/components/tiktok-slide-editor'
import { SlideNavigator } from '@/components/slide-navigator'
import { Layers, List } from 'lucide-react'
import type { IdeaWithDetails, Persona, Country, SlideLayoutConfig } from '@/types'

const SLIDE_TYPE_OPTIONS = [
  { value: 'hook', label: 'Hook' },
  { value: 'problem', label: 'Problem' },
  { value: 'agitation', label: 'Agitation' },
  { value: 'solution', label: 'Solution' },
  { value: 'benefit', label: 'Benefit' },
  { value: 'proof', label: 'Proof' },
  { value: 'cta', label: 'Call to Action' },
  { value: 'extra', label: 'Extra' },
]

type TextVariantState = {
  id: string
  variant_label: string
  content: string
  layoutConfig: SlideLayoutConfig
}

type ImageVariantState = {
  id: string
  variant_label: string
  storage_path: string
  caption: string
  aspect_ratio?: string
  metadata?: Record<string, any>
  previewUrl?: string
}

type SlideState = {
  id: string
  slide_number: number
  slide_type: string
  title: string
  textVariants: TextVariantState[]
  imageVariants: ImageVariantState[]
}

type CountryState = {
  country: Country
  selected: boolean
  slides: SlideState[]
}

type PersonaState = {
  persona_type: Persona
  active: boolean
  countries: CountryState[]
}

const randomId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const createLayoutConfig = (): SlideLayoutConfig => ({
  version: 1,
  canvas: { width: 1080, height: 1920 },
  safeZone: { top: 180, bottom: 220 },
  background: { color: '#0F1A2C' },
  layers: [],
})

const cloneLayoutConfig = (layout?: SlideLayoutConfig): SlideLayoutConfig => {
  if (!layout) return createLayoutConfig()
  return {
    ...layout,
    layers: layout.layers.map((layer) => ({
      ...layer,
      id: randomId(),
    })),
  }
}

const createTextVariant = (idx = 1): TextVariantState => ({
  id: randomId(),
  variant_label: `Variant ${idx}`,
  content: '',
  layoutConfig: createLayoutConfig(),
})

const createImageVariant = (idx = 1): ImageVariantState => ({
  id: randomId(),
  variant_label: `Image ${idx}`,
  storage_path: '',
  caption: '',
  aspect_ratio: '',
  metadata: {},
  previewUrl: '',
})

const createSlide = (position: number): SlideState => ({
  id: randomId(),
  slide_number: position,
  slide_type: SLIDE_TYPE_OPTIONS[0].value,
  title: '',
  textVariants: [createTextVariant(1)],
  imageVariants: [],
})

function ensureSlides(slides: SlideState[], selected: boolean) {
  if (!selected) return []
  if (slides.length === 0) return [createSlide(1)]
  return slides
}

function normalizeSlideNumbers(slides: SlideState[]) {
  return slides.map((slide, idx) => ({ ...slide, slide_number: idx + 1 }))
}

interface IdeaFormProps {
  mode: 'create' | 'edit'
  ideaId?: string
  initialIdea?: IdeaWithDetails
}

export function IdeaForm({ mode, ideaId, initialIdea }: IdeaFormProps) {
  const [title, setTitle] = useState(initialIdea?.title || '')
  const [category, setCategory] = useState(initialIdea?.category || '')
  const [description, setDescription] = useState(initialIdea?.description || '')
  const basePersonas = useMemo<PersonaState[]>(() => {
    const hasInitialIdea = Boolean(initialIdea)
    return PERSONAS.map((persona) => {
      const personaDetails = initialIdea?.personas?.find(
        (p) => p.persona_type === persona
      )
      const active = Boolean(personaDetails)

      const countries: CountryState[] = COUNTRIES.map((country) => {
        const countryDetails = personaDetails?.countries?.find(
          (c) => c.country === country
        )
        const selected =
          Boolean(countryDetails) ||
          (!hasInitialIdea && persona === 'main' && country === 'uk')
        const slideStates: SlideState[] =
          countryDetails?.slides?.map((slide, idx) => ({
            id: slide.id || randomId(),
            slide_number: slide.slide_number || idx + 1,
            slide_type: slide.slide_type || SLIDE_TYPE_OPTIONS[0].value,
            title: slide.title || '',
            textVariants: (
              slide.text_variants?.length
                ? slide.text_variants
                : slide.content
                ? [
                    {
                      id: randomId(),
                      variant_label: 'Variant 1',
                      content: slide.content,
                    },
                  ]
                : [createTextVariant(1)]
            ).map((variant, vIdx) => ({
              id: variant.id || randomId(),
              variant_label: variant.variant_label || `Variant ${vIdx + 1}`,
              content: variant.content || '',
              layoutConfig: cloneLayoutConfig(
                (variant as any).layout_config || (variant as any).layoutConfig
              ),
            })),
            imageVariants: (slide.image_variants || []).map((variant, vIdx) => ({
              id: variant.id || randomId(),
              variant_label: variant.variant_label || `Image ${vIdx + 1}`,
              storage_path: variant.storage_path || '',
              caption: variant.caption || '',
              aspect_ratio: variant.aspect_ratio || '',
              metadata: variant.metadata || {},
              previewUrl:
                (variant.metadata && variant.metadata.publicUrl) || undefined,
            })),
          })) || []

        return {
          country,
          selected,
          slides: ensureSlides(normalizeSlideNumbers(slideStates), selected),
        }
      })

      return {
        persona_type: persona,
        active: active || persona === 'main',
        countries,
      }
    })
  }, [initialIdea])

  const [personas, setPersonas] = useState<PersonaState[]>(basePersonas)
  const [activePersona, setActivePersona] = useState<Persona>(
    () => basePersonas.find((p) => p.active)?.persona_type || 'main'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingVariantId, setUploadingVariantId] = useState<string | null>(null)
  const [slideViewMode, setSlideViewMode] = useState<'navigator' | 'detailed'>('navigator')

  const activePersonaData = personas.find((p) => p.persona_type === activePersona)!

  const updatePersonas = (updater: (prev: PersonaState[]) => PersonaState[]) => {
    setPersonas((prev) => updater(prev))
  }

  const updateCountry = (
    personaType: Persona,
    country: Country,
    updater: (country: CountryState) => CountryState
  ) => {
    updatePersonas((prev) =>
      prev.map((persona) =>
        persona.persona_type === personaType
          ? {
              ...persona,
              countries: persona.countries.map((c) =>
                c.country === country ? updater(c) : c
              ),
            }
          : persona
      )
    )
  }

  const updateSlide = (
    personaType: Persona,
    country: Country,
    slideId: string,
    updater: (slide: SlideState) => SlideState
  ) => {
    updateCountry(personaType, country, (countryState) => {
      const updatedSlides = countryState.slides.map((slide) =>
        slide.id === slideId ? updater(slide) : slide
      )
      return {
        ...countryState,
        slides: normalizeSlideNumbers(updatedSlides),
      }
    })
  }

  const addSlide = (personaType: Persona, country: Country) => {
    updateCountry(personaType, country, (countryState) => {
      const nextNumber = countryState.slides.length + 1
      return {
        ...countryState,
        slides: normalizeSlideNumbers([...countryState.slides, createSlide(nextNumber)]),
      }
    })
  }

  const removeSlide = (personaType: Persona, country: Country, slideId: string) => {
    updateCountry(personaType, country, (countryState) => {
      const remaining = countryState.slides.filter((slide) => slide.id !== slideId)
      return {
        ...countryState,
        slides: normalizeSlideNumbers(remaining.length ? remaining : [createSlide(1)]),
      }
    })
  }

  const duplicateSlide = (personaType: Persona, country: Country, slideId: string) => {
    updateCountry(personaType, country, (countryState) => {
      const index = countryState.slides.findIndex((slide) => slide.id === slideId)
      if (index === -1) return countryState
      const target = countryState.slides[index]
      const duplicated: SlideState = {
        ...target,
        id: randomId(),
        title: target.title ? `${target.title} Copy` : target.title,
        textVariants: target.textVariants.map((variant) => ({
          ...variant,
          id: randomId(),
          variant_label: `${variant.variant_label} Copy`,
          layoutConfig: cloneLayoutConfig(variant.layoutConfig),
        })),
        imageVariants: target.imageVariants.map((variant) => ({
          ...variant,
          id: randomId(),
          variant_label: `${variant.variant_label} Copy`,
        })),
      }
      const slides = [...countryState.slides]
      slides.splice(index + 1, 0, duplicated)
      return {
        ...countryState,
        slides: normalizeSlideNumbers(slides),
      }
    })
  }

  const addTextVariant = (personaType: Persona, country: Country, slideId: string) => {
    updateSlide(personaType, country, slideId, (slide) => ({
      ...slide,
      textVariants: [...slide.textVariants, createTextVariant(slide.textVariants.length + 1)],
    }))
  }

  const updateTextVariant = (
    personaType: Persona,
    country: Country,
    slideId: string,
    variantId: string,
    changes: Partial<TextVariantState>
  ) => {
    updateSlide(personaType, country, slideId, (slide) => ({
      ...slide,
      textVariants: slide.textVariants.map((variant) =>
        variant.id === variantId ? { ...variant, ...changes } : variant
      ),
    }))
  }

  const removeTextVariant = (
    personaType: Persona,
    country: Country,
    slideId: string,
    variantId: string
  ) => {
    updateSlide(personaType, country, slideId, (slide) => {
      const remaining = slide.textVariants.filter((variant) => variant.id !== variantId)
      return {
        ...slide,
        textVariants: remaining.length ? remaining : [createTextVariant(1)],
      }
    })
  }

  const duplicateTextVariant = (
    personaType: Persona,
    country: Country,
    slideId: string,
    variantId: string
  ) => {
    updateSlide(personaType, country, slideId, (slide) => {
      const idx = slide.textVariants.findIndex((variant) => variant.id === variantId)
      if (idx === -1) return slide
      const source = slide.textVariants[idx]
      const clone: TextVariantState = {
        ...source,
        id: randomId(),
        variant_label: `${source.variant_label} Copy`,
        layoutConfig: cloneLayoutConfig(source.layoutConfig),
      }
      const next = [...slide.textVariants]
      next.splice(idx + 1, 0, clone)
      return {
        ...slide,
        textVariants: next,
      }
    })
  }

  const addImageVariant = (personaType: Persona, country: Country, slideId: string) => {
    updateSlide(personaType, country, slideId, (slide) => ({
      ...slide,
      imageVariants: [
        ...slide.imageVariants,
        createImageVariant(slide.imageVariants.length + 1),
      ],
    }))
  }

  const updateImageVariant = (
    personaType: Persona,
    country: Country,
    slideId: string,
    variantId: string,
    changes: Partial<ImageVariantState>
  ) => {
    updateSlide(personaType, country, slideId, (slide) => ({
      ...slide,
      imageVariants: slide.imageVariants.map((variant) =>
        variant.id === variantId ? { ...variant, ...changes } : variant
      ),
    }))
  }

  const removeImageVariant = (
    personaType: Persona,
    country: Country,
    slideId: string,
    variantId: string
  ) => {
    updateSlide(personaType, country, slideId, (slide) => ({
      ...slide,
      imageVariants: slide.imageVariants.filter((variant) => variant.id !== variantId),
    }))
  }

  const togglePersona = (personaType: Persona) => {
    updatePersonas((prev) => {
      const updated = prev.map((persona) =>
        persona.persona_type === personaType
          ? { ...persona, active: !persona.active }
          : persona
      )

      if (activePersona === personaType) {
        const nextActive = updated.find((p) => p.active && p.persona_type !== personaType)
        if (nextActive) {
          setActivePersona(nextActive.persona_type)
        } else {
          setActivePersona('main')
        }
      } else if (!updated.find((p) => p.persona_type === personaType)?.active) {
        setActivePersona('main')
      }

      return updated
    })
  }

  const toggleCountry = (personaType: Persona, country: Country) => {
    updateCountry(personaType, country, (countryState) => {
      const selected = !countryState.selected
      return {
        ...countryState,
        selected,
        slides: ensureSlides(countryState.slides, selected),
      }
    })
  }

  const handleImageUpload = async (
    personaType: Persona,
    country: Country,
    slideId: string,
    variantId: string,
    file: File | null
  ) => {
    if (!file) return
    setUploadingVariantId(variantId)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ideaId', ideaId || 'new-idea')
      formData.append('persona', personaType)
      formData.append('country', country)
      formData.append('slide', slideId)
      formData.append('variant', variantId)

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload image')
      }

      const data = await response.json()
      updateImageVariant(personaType, country, slideId, variantId, {
        storage_path: data.path,
        previewUrl: data.url,
        metadata: { publicUrl: data.url },
      })
    } catch (err: any) {
      setError(err.message || 'Failed to upload image')
    } finally {
      setUploadingVariantId(null)
    }
  }

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
        countries: persona.countries
          .filter((country) => country.selected)
          .map((country) => {
            const slides = country.slides
              .map((slide, idx) => {
                const textVariants = slide.textVariants
                  .map((variant, vIdx) => {
                    const fallbackFromLayers = variant.layoutConfig.layers
                      .map((layer) => layer.text.trim())
                      .filter((text) => text.length > 0)
                      .join('\n')
                      .trim()
                    const contentValue = variant.content.trim()
                      ? variant.content.trim()
                      : fallbackFromLayers

                    return {
                      variant_label: variant.variant_label || `Variant ${vIdx + 1}`,
                      content: contentValue,
                      layout_config: variant.layoutConfig,
                    }
                  })
                  .filter((variant) => variant.content.length > 0)

                const imageVariants = slide.imageVariants
                  .filter((variant) => variant.storage_path)
                  .map((variant, vIdx) => ({
                    variant_label: variant.variant_label || `Image ${vIdx + 1}`,
                    storage_path: variant.storage_path,
                    caption: variant.caption || undefined,
                    aspect_ratio: variant.aspect_ratio || undefined,
                    metadata: variant.metadata || {},
                  }))

                if (textVariants.length === 0 && imageVariants.length === 0) {
                  return null
                }

                return {
                  slide_number: idx + 1,
                  slide_type: slide.slide_type,
                  title: slide.title || undefined,
                  text_variants: textVariants,
                  image_variants: imageVariants,
                }
              })
              .filter(Boolean)

            return {
              country: country.country,
              slides,
            }
          })
          .filter((country) => country.slides.length > 0),
      }))

      if (
        !personasPayload.some((persona) =>
          persona.countries.some((country) => country.slides.length > 0)
        )
      ) {
        throw new Error('Add at least one slide with content or images before saving')
      }

      const payload = {
        title,
        category,
        description: description || undefined,
        personas: personasPayload,
      }

      const endpoint =
        mode === 'create' ? '/api/ideas' : `/api/ideas/${ideaId ?? ''}`
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
      await new Promise((resolve) => setTimeout(resolve, 200))
      window.location.href = `/ideas/${idea?.id || ideaId}`
    } catch (err: any) {
      setError(err.message || 'Failed to save idea')
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4 border-b border-border pb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Enter idea title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category *</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., Lifestyle, Finance, Health"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Optional description of your idea"
          />
        </div>
      </div>

      <div className="space-y-4 border-b border-border pb-6">
        <h2 className="text-xl font-semibold">Personas</h2>
        <div className="flex gap-2 flex-wrap">
          {PERSONAS.map((persona) => {
            const personaData = personas.find((p) => p.persona_type === persona)!
            const isActive = personaData.active
            const isCurrent = activePersona === persona && isActive
            return (
              <button
                key={persona}
                type="button"
                onClick={() => {
                  if (isActive && activePersona === persona) {
                    togglePersona(persona)
                  } else if (isActive) {
                    setActivePersona(persona)
                  } else {
                    togglePersona(persona)
                    setActivePersona(persona)
                  }
                }}
                className={`px-4 py-2 rounded-md border transition-colors ${
                  isActive
                    ? isCurrent
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-primary/20 border-primary text-foreground'
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

      <div className="space-y-4 border-b border-border pb-6">
        <h2 className="text-xl font-semibold">
          Countries – {PERSONA_LABELS[activePersona]}
        </h2>
        <div className="flex gap-2 flex-wrap">
          {COUNTRIES.map((country) => {
            const countryData = activePersonaData.countries.find(
              (c) => c.country === country
            )!
            return (
              <button
                key={country}
                type="button"
                onClick={() => toggleCountry(activePersona, country)}
                className={`px-4 py-2 rounded-md border transition-colors ${
                  countryData.selected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:bg-accent'
                }`}
              >
                {COUNTRY_LABELS[country]}
                {countryData.selected && <span className="ml-2 text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {activePersonaData.countries.some((country) => country.selected) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Slides & Variants</h2>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={slideViewMode === 'navigator' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSlideViewMode('navigator')}
              >
                <Layers className="h-4 w-4 mr-1" />
                Navigator
              </Button>
              <Button
                type="button"
                variant={slideViewMode === 'detailed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSlideViewMode('detailed')}
              >
                <List className="h-4 w-4 mr-1" />
                Detailed
              </Button>
            </div>
          </div>
          {activePersonaData.countries.map((country) => {
            if (!country.selected) return null
            return (
              <div key={country.country} className="border border-border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{COUNTRY_LABELS[country.country]}</h3>
                  {slideViewMode === 'detailed' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addSlide(activePersona, country.country)}
                    >
                      Add Slide
                    </Button>
                  )}
                </div>

                {slideViewMode === 'navigator' ? (
                  <SlideNavigator
                    slides={country.slides}
                    persona={activePersona}
                    country={country.country}
                    ideaTitle={title || 'untitled'}
                    onUpdateSlide={(slideId, updater) =>
                      updateSlide(activePersona, country.country, slideId, updater)
                    }
                    onAddSlide={() => addSlide(activePersona, country.country)}
                    onRemoveSlide={(slideId) => removeSlide(activePersona, country.country, slideId)}
                    onDuplicateSlide={(slideId) => duplicateSlide(activePersona, country.country, slideId)}
                  />
                ) : (
                  /* Detailed View - Original UI */
                  <div className="space-y-4">
                  {country.slides.map((slide) => (
                    <div key={slide.id} className="border border-dashed rounded-md p-4 space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <span className="text-sm font-semibold">
                            Slide {slide.slide_number}
                          </span>
                          <select
                            value={slide.slide_type}
                            onChange={(e) =>
                              updateSlide(activePersona, country.country, slide.id, (prev) => ({
                                ...prev,
                                slide_type: e.target.value,
                              }))
                            }
                            className="px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {SLIDE_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateSlide(activePersona, country.country, slide.id)}
                          >
                            Duplicate
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeSlide(activePersona, country.country, slide.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs uppercase text-muted-foreground mb-1">
                          Internal Title
                        </label>
                        <input
                          type="text"
                          value={slide.title}
                          onChange={(e) =>
                            updateSlide(activePersona, country.country, slide.id, (prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Optional label to identify this slide"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Text Variants</h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addTextVariant(activePersona, country.country, slide.id)}
                          >
                            Add Text Variant
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {slide.textVariants.map((variant) => (
                            <div key={variant.id} className="space-y-3 rounded-md border border-border p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <input
                                  type="text"
                                  value={variant.variant_label}
                                  onChange={(e) =>
                                    updateTextVariant(
                                      activePersona,
                                      country.country,
                                      slide.id,
                                      variant.id,
                                      { variant_label: e.target.value }
                                    )
                                  }
                                  className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                  placeholder="Variant label"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      duplicateTextVariant(
                                        activePersona,
                                        country.country,
                                        slide.id,
                                        variant.id
                                      )
                                    }
                                  >
                                    Duplicate
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      removeTextVariant(
                                        activePersona,
                                        country.country,
                                        slide.id,
                                        variant.id
                                      )
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                              <textarea
                                value={variant.content}
                                onChange={(e) =>
                                  updateTextVariant(
                                    activePersona,
                                    country.country,
                                    slide.id,
                                    variant.id,
                                    { content: e.target.value }
                                  )
                                }
                                rows={3}
                                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Enter copy for this variant"
                              />
                              <div className="rounded-md border border-dashed border-border/70 bg-muted/40 p-3">
                                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold leading-tight">Design Canvas</p>
                                    <p className="text-xs text-muted-foreground">
                                      Layout multiple text blocks, drag to position, and preview downloads.
                                    </p>
                                  </div>
                                </div>
                                <TiktokSlideEditor
                                  key={`${slide.id}-${variant.id}`}
                                  variantId={variant.id}
                                  variantLabel={variant.variant_label}
                                  content={variant.content}
                                  layoutConfig={variant.layoutConfig}
                                  onContentChange={(content) =>
                                    updateTextVariant(
                                      activePersona,
                                      country.country,
                                      slide.id,
                                      variant.id,
                                      { content }
                                    )
                                  }
                                  onLayoutChange={(layoutConfig) =>
                                    updateTextVariant(
                                      activePersona,
                                      country.country,
                                      slide.id,
                                      variant.id,
                                      { layoutConfig }
                                    )
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Image Variants</h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addImageVariant(activePersona, country.country, slide.id)}
                          >
                            Add Image Variant
                          </Button>
                        </div>

                        {slide.imageVariants.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Optional: attach reference images for this slide.
                          </p>
                        )}

                        <div className="space-y-3">
                          {slide.imageVariants.map((variant) => (
                            <div key={variant.id} className="space-y-2 rounded-md border border-border p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input
                                  type="text"
                                  value={variant.variant_label}
                                  onChange={(e) =>
                                    updateImageVariant(
                                      activePersona,
                                      country.country,
                                      slide.id,
                                      variant.id,
                                      { variant_label: e.target.value }
                                    )
                                  }
                                  className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                  placeholder="Image label"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() =>
                                    removeImageVariant(
                                      activePersona,
                                      country.country,
                                      slide.id,
                                      variant.id
                                    )
                                  }
                                >
                                  Remove
                                </Button>
                              </div>

                              <input
                                type="text"
                                value={variant.caption}
                                onChange={(e) =>
                                  updateImageVariant(
                                    activePersona,
                                    country.country,
                                    slide.id,
                                    variant.id,
                                    { caption: e.target.value }
                                  )
                                }
                                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Optional caption"
                              />

                              <input
                                type="text"
                                value={variant.aspect_ratio || ''}
                                onChange={(e) =>
                                  updateImageVariant(
                                    activePersona,
                                    country.country,
                                    slide.id,
                                    variant.id,
                                    { aspect_ratio: e.target.value }
                                  )
                                }
                                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Aspect ratio (e.g., 9:16)"
                              />

                              <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-3">
                                  <input
                                    type="text"
                                    readOnly
                                    value={variant.storage_path}
                                    className="flex-1 px-3 py-2 border border-border rounded-md bg-muted text-foreground"
                                    placeholder="Upload to generate storage path"
                                  />
                                  <label className="text-sm font-medium">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) =>
                                        handleImageUpload(
                                          activePersona,
                                          country.country,
                                          slide.id,
                                          variant.id,
                                          e.target.files?.[0] || null
                                        )
                                      }
                                    />
                                    <span
                                      className={`inline-flex items-center px-3 py-2 border border-border rounded-md cursor-pointer ${
                                        uploadingVariantId === variant.id
                                          ? 'opacity-60'
                                          : ''
                                      }`}
                                    >
                                      {uploadingVariantId === variant.id ? 'Uploading...' : 'Upload'}
                                    </span>
                                  </label>
                                  {variant.previewUrl && (
                                    <a
                                      href={variant.previewUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sm text-primary underline"
                                    >
                                      Preview
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (mode === 'create' ? 'Creating...' : 'Updating...') : mode === 'create' ? 'Create Idea' : 'Update Idea'}
        </Button>
        <Link href={mode === 'create' ? '/ideas' : `/ideas/${ideaId}`}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  )
}

