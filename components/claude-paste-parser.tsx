'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Sparkles, ClipboardPaste } from 'lucide-react'

// Maps slide index (0-based) to slide type
const SLIDE_TYPES = ['hook', 'problem', 'agitation', 'solution', 'benefit', 'proof', 'cta']

export interface ParsedSlideText {
  slideIndex: number   // 0-based
  slideType: string
  uk_v1: string
  uk_v2: string
  us_v1: string
  us_v2: string
}

interface ClaudePasteParserProps {
  onParsed: (slides: ParsedSlideText[]) => void
  slideCount: number
}

/**
 * Parses Claude's slideshow output format:
 *
 * **SLIDE 1 — HOOK**
 * 1. *"text"*
 * 2. *"text"*
 * 3. *"text"*
 * 4. *"text"*
 *
 * Variants 1 & 2 → UK (v1, v2)
 * Variants 3 & 4 → US (v1, v2)
 * KSA & MY → auto-translated separately
 */
function parseClaudeOutput(raw: string): ParsedSlideText[] {
  const results: ParsedSlideText[] = []

  // Split on slide headers: **SLIDE N** or **SLIDE N — TYPE** or --- separators
  // Also handle markdown headers like ## SLIDE 1
  const slideBlocks = raw.split(/(?=\*{0,2}SLIDE\s+\d+|##\s*SLIDE\s+\d+)/i).filter(Boolean)

  for (const block of slideBlocks) {
    // Extract slide number
    const slideNumMatch = block.match(/SLIDE\s+(\d+)/i)
    if (!slideNumMatch) continue

    const slideNum = parseInt(slideNumMatch[1], 10)
    const slideIndex = slideNum - 1 // 0-based
    const slideType = SLIDE_TYPES[Math.min(slideIndex, SLIDE_TYPES.length - 1)]

    // Extract variants — supports two formats:
    // Format A (numbered):  1. *"text"*  /  1. "text"  /  1. text
    // Format B (plain):     "text"  or bare lines (one per line, 4 lines = uk_v1..us_v2)
    const variants: string[] = []

    // Try Format A first: numbered lines
    const variantRegex = /^\s*(\d+)\.\s*\*{0,1}"?([^*\n]+)"?\*{0,1}\s*$/gm
    let match
    while ((match = variantRegex.exec(block)) !== null) {
      const variantNum = parseInt(match[1], 10)
      let text = match[2].trim()
      text = text.replace(/^\*?"?|"?\*?$/g, '').trim()
      text = text.replace(/^["']|["']$/g, '').trim()
      variants[variantNum - 1] = text
    }

    // Format B fallback: plain quoted or unquoted lines (skip the header line)
    if (variants.filter(Boolean).length < 2) {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !/^(\*{0,2}SLIDE\s+\d+|##\s*SLIDE)/i.test(l)) // skip header
        .map((l) => l.replace(/^["']|["']$/g, '').trim())                   // strip outer quotes
        .filter(Boolean)
      lines.forEach((text, i) => { variants[i] = text })
    }

    // Need at least 2 variants
    if (variants.filter(Boolean).length < 2) continue

    results.push({
      slideIndex,
      slideType,
      uk_v1: variants[0] || '',
      uk_v2: variants[1] || '',
      us_v1: variants[2] || variants[0] || '', // fallback to UK if no US variants
      us_v2: variants[3] || variants[1] || '',
    })
  }

  return results
}

export function ClaudePasteParser({ onParsed, slideCount }: ClaudePasteParserProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [rawText, setRawText] = useState('')
  const [preview, setPreview] = useState<ParsedSlideText[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParse = () => {
    setError(null)
    if (!rawText.trim()) {
      setError('Paste Claude\'s output first.')
      return
    }

    const parsed = parseClaudeOutput(rawText)

    if (parsed.length === 0) {
      setError('Could not find any slides. Make sure you paste the full Claude output with **SLIDE 1**, **SLIDE 2** etc.')
      return
    }

    setPreview(parsed)
  }

  const handleApply = () => {
    if (!preview) return
    onParsed(preview)
    setIsOpen(false)
    setRawText('')
    setPreview(null)
  }

  const handleClose = () => {
    setIsOpen(false)
    setRawText('')
    setPreview(null)
    setError(null)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <ClipboardPaste className="h-4 w-4 mr-1" />
        Paste Claude Script
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Paste Claude Script</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paste the full slideshow output from Claude. Variants 1 & 2 → UK, 3 & 4 → US. KSA & MY will be auto-translated.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-md hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {!preview ? (
                <>
                  <textarea
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value)
                      setError(null)
                    }}
                    rows={14}
                    className="w-full px-3 py-2 border border-border rounded-md bg-muted/40 text-sm font-mono resize-y"
                    placeholder={`Paste Claude's output here. Expected format:\n\n**SLIDE 1 — HOOK**\n1. *"First variant text"*\n2. *"Second variant text"*\n3. *"Third variant text"*\n4. *"Fourth variant text"*\n\n**SLIDE 2**\n1. *"text"*\n...`}
                  />
                  {error && (
                    <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-md">
                      {error}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleParse} disabled={!rawText.trim()}>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Parse
                    </Button>
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <p className="text-sm text-emerald-600 font-medium">
                      ✓ Found {preview.length} slide{preview.length !== 1 ? 's' : ''}. Review before applying:
                    </p>
                    {preview.map((slide) => (
                      <div key={slide.slideIndex} className="border border-border rounded-lg p-3 space-y-2">
                        <p className="text-xs font-bold uppercase text-muted-foreground">
                          Slide {slide.slideIndex + 1} — {slide.slideType}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted/50 rounded p-2">
                            <p className="font-semibold text-primary mb-1">🇬🇧 UK V1</p>
                            <p className="text-foreground">{slide.uk_v1 || <span className="text-muted-foreground italic">empty</span>}</p>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <p className="font-semibold text-primary mb-1">🇬🇧 UK V2</p>
                            <p className="text-foreground">{slide.uk_v2 || <span className="text-muted-foreground italic">empty</span>}</p>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <p className="font-semibold text-blue-500 mb-1">🇺🇸 US V1</p>
                            <p className="text-foreground">{slide.us_v1 || <span className="text-muted-foreground italic">empty</span>}</p>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <p className="font-semibold text-blue-500 mb-1">🇺🇸 US V2</p>
                            <p className="text-foreground">{slide.us_v2 || <span className="text-muted-foreground italic">empty</span>}</p>
                          </div>
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          🌐 KSA & MY will be auto-translated from UK text after applying.
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button type="button" onClick={handleApply}>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Apply to All Slides
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPreview(null)}
                    >
                      ← Back
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleClose}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
