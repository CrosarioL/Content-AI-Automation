'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Layers, Grid3X3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TiktokSlideEditor } from '@/components/tiktok-slide-editor'
import { BatchExport } from '@/components/batch-export'
import type { SlideLayoutConfig, Country, Persona } from '@/types'

const SLIDE_TYPE_LABELS: Record<string, string> = {
  hook: 'Hook',
  problem: 'Problem',
  agitation: 'Agitation',
  solution: 'Solution',
  benefit: 'Benefit',
  proof: 'Proof',
  cta: 'CTA',
  extra: 'Extra',
}

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

interface SlideNavigatorProps {
  slides: SlideState[]
  persona: Persona
  country: Country
  ideaTitle?: string
  onUpdateSlide: (slideId: string, updater: (slide: SlideState) => SlideState) => void
  onAddSlide: () => void
  onRemoveSlide: (slideId: string) => void
  onDuplicateSlide: (slideId: string) => void
}

type ViewMode = 'navigator' | 'editor'

export function SlideNavigator({
  slides,
  persona,
  country,
  ideaTitle = 'slides',
  onUpdateSlide,
  onAddSlide,
  onRemoveSlide,
  onDuplicateSlide,
}: SlideNavigatorProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [currentVariantIndex, setCurrentVariantIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('navigator')

  const currentSlide = slides[currentSlideIndex]
  const currentVariant = currentSlide?.textVariants[currentVariantIndex]

  const goToSlide = useCallback((index: number) => {
    setCurrentSlideIndex(Math.max(0, Math.min(index, slides.length - 1)))
    setCurrentVariantIndex(0)
  }, [slides.length])

  const goToPrevSlide = useCallback(() => {
    goToSlide(currentSlideIndex - 1)
  }, [currentSlideIndex, goToSlide])

  const goToNextSlide = useCallback(() => {
    goToSlide(currentSlideIndex + 1)
  }, [currentSlideIndex, goToSlide])

  const goToVariant = useCallback((index: number) => {
    if (!currentSlide) return
    setCurrentVariantIndex(Math.max(0, Math.min(index, currentSlide.textVariants.length - 1)))
  }, [currentSlide])

  const updateTextVariant = useCallback((
    variantId: string,
    changes: Partial<TextVariantState>
  ) => {
    if (!currentSlide) return
    onUpdateSlide(currentSlide.id, (slide) => ({
      ...slide,
      textVariants: slide.textVariants.map((v) =>
        v.id === variantId ? { ...v, ...changes } : v
      ),
    }))
  }, [currentSlide, onUpdateSlide])

  const thumbnailContent = useMemo(() => {
    return slides.map((slide) => {
      const firstVariant = slide.textVariants[0]
      const previewText = firstVariant?.content?.slice(0, 50) || 
                          firstVariant?.layoutConfig?.layers?.[0]?.text?.slice(0, 50) ||
                          'Empty slide'
      return {
        id: slide.id,
        number: slide.slide_number,
        type: slide.slide_type,
        preview: previewText,
        variantCount: slide.textVariants.length,
      }
    })
  }, [slides])

  if (!currentSlide) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg">
        <p className="text-muted-foreground mb-4">No slides yet</p>
        <Button onClick={onAddSlide}>Add First Slide</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Navigation Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'navigator' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('navigator')}
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Overview
          </Button>
          <Button
            variant={viewMode === 'editor' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('editor')}
          >
            <Layers className="h-4 w-4 mr-1" />
            Editor
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            Slide {currentSlideIndex + 1} of {slides.length}
          </span>
          <BatchExport
            slides={slides}
            ideaTitle={ideaTitle}
            persona={persona}
            country={country}
          />
          <Button variant="outline" size="sm" onClick={onAddSlide}>
            + Add Slide
          </Button>
        </div>
      </div>

      {viewMode === 'navigator' ? (
        /* Thumbnail Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {thumbnailContent.map((thumb, index) => (
            <button
              key={thumb.id}
              type="button"
              onClick={() => {
                goToSlide(index)
                setViewMode('editor')
              }}
              className={`relative aspect-[9/16] rounded-lg border-2 p-2 text-left transition-all hover:border-primary/50 ${
                index === currentSlideIndex
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-muted/30'
              }`}
            >
              <div className="absolute inset-0 flex flex-col p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-primary">
                    {thumb.number}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {SLIDE_TYPE_LABELS[thumb.type] || thumb.type}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[10px] text-muted-foreground line-clamp-4">
                    {thumb.preview}
                  </p>
                </div>
                {thumb.variantCount > 1 && (
                  <div className="absolute bottom-1 right-1 bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full">
                    {thumb.variantCount} variants
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Editor View */
        <div className="space-y-4">
          {/* Slide Strip Navigation */}
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex gap-1 flex-1 justify-center">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    index === currentSlideIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-accent'
                  }`}
                >
                  {slide.slide_number}
                </button>
              ))}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextSlide}
              disabled={currentSlideIndex === slides.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Current Slide Info */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <h3 className="font-semibold">
                Slide {currentSlide.slide_number}: {SLIDE_TYPE_LABELS[currentSlide.slide_type] || currentSlide.slide_type}
              </h3>
              {currentSlide.title && (
                <p className="text-sm text-muted-foreground">{currentSlide.title}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDuplicateSlide(currentSlide.id)}
              >
                Duplicate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRemoveSlide(currentSlide.id)
                  if (currentSlideIndex > 0) {
                    setCurrentSlideIndex(currentSlideIndex - 1)
                  }
                }}
                className="text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            </div>
          </div>

          {/* Variant Tabs */}
          {currentSlide.textVariants.length > 1 && (
            <div className="flex gap-2 border-b border-border pb-2">
              {currentSlide.textVariants.map((variant, index) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => goToVariant(index)}
                  className={`px-3 py-1.5 rounded-t text-sm transition-colors ${
                    index === currentVariantIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-accent'
                  }`}
                >
                  {variant.variant_label}
                </button>
              ))}
            </div>
          )}

          {/* Current Variant Editor */}
          {currentVariant && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={currentVariant.variant_label}
                  onChange={(e) =>
                    updateTextVariant(currentVariant.id, { variant_label: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Variant label"
                />
              </div>
              
              <textarea
                value={currentVariant.content}
                onChange={(e) =>
                  updateTextVariant(currentVariant.id, { content: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter copy for this variant"
              />

              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <div className="mb-2">
                  <p className="text-sm font-semibold">Design Canvas</p>
                  <p className="text-xs text-muted-foreground">
                    Drag text blocks to position them. Use the controls to style and download.
                  </p>
                </div>
                <TiktokSlideEditor
                  key={`${currentSlide.id}-${currentVariant.id}`}
                  variantId={currentVariant.id}
                  variantLabel={currentVariant.variant_label}
                  content={currentVariant.content}
                  layoutConfig={currentVariant.layoutConfig}
                  onContentChange={(content) =>
                    updateTextVariant(currentVariant.id, { content })
                  }
                  onLayoutChange={(layoutConfig) =>
                    updateTextVariant(currentVariant.id, { layoutConfig })
                  }
                />
              </div>
            </div>
          )}

          {/* Keyboard hints */}
          <div className="text-xs text-muted-foreground text-center">
            Use arrow keys to navigate • Ctrl+Z to undo • Ctrl+C/V to copy/paste layers
          </div>
        </div>
      )}
    </div>
  )
}

