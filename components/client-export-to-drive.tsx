'use client'

/**
 * Client-side export: renders slides in the browser (same as editor) for exact font match,
 * then uploads ZIP to Drive.
 */
import React, { useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { SlideExportCanvas } from '@/components/slide-export-canvas'
import JSZip from 'jszip'
import type { SlideLayoutConfig } from '@/types'
import type { ExportPreparePayload } from '@/lib/export-build-layouts'
import { COUNTRY_LABELS, COUNTRIES } from '@/lib/constants'

function renderSlideToDataUrl(layoutConfig: SlideLayoutConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div')
    const w = layoutConfig.canvas?.width ?? 1080
    const h = layoutConfig.canvas?.height ?? 1920
    container.style.cssText = `position:absolute;left:-9999px;width:${w}px;height:${h}px;`
    document.body.appendChild(container)

    const stageRef = { current: null as any }
    const handleReady = () => {
      try {
        const stage = stageRef.current
        if (stage) {
          const dataUrl = stage.toDataURL({ mimeType: 'image/jpeg', quality: 0.9 })
          resolve(dataUrl)
        } else {
          reject(new Error('Stage ref not ready'))
        }
      } catch (e) {
        reject(e)
      } finally {
        document.body.removeChild(container)
        root.unmount()
      }
    }

    const Root = () => (
      <SlideExportCanvas
        layout={layoutConfig}
        backgroundImageUrl={layoutConfig.background?.image}
        stageRef={stageRef as any}
        onReady={handleReady}
      />
    )

    const root = createRoot(container)
    root.render(<Root />)
  })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-').slice(0, 50)
}

export function useClientExportToDrive(ideaId: string) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const exportToDrive = useCallback(async (): Promise<{ success: boolean; webViewLink?: string; error?: string }> => {
    setIsExporting(true)
    setError(null)
    setSuccess(null)
    setProgress('Preparing...')

    try {
      const prepareRes = await fetch(`/api/ideas/${ideaId}/export/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!prepareRes.ok) {
        const d = await prepareRes.json()
        throw new Error(d.error || 'Prepare failed')
      }

      const payload: ExportPreparePayload = await prepareRes.json()

      let totalSlides = 0
      for (const post of payload.posts) {
        totalSlides += post.slides.length
      }

      // Build one zip per country (download one country at a time from Drive)
      const countryZips = new Map<string, JSZip>()
      const countries = [...new Set(payload.posts.map((p) => p.country))]
      for (const c of countries) {
        countryZips.set(c, new JSZip())
      }

      let done = 0
      for (const post of payload.posts) {
        const countryLabel = COUNTRY_LABELS[post.country as keyof typeof COUNTRY_LABELS] || post.country.toUpperCase()
        const zip = countryZips.get(post.country)!
        const postFolder = zip.folder(`${countryLabel} Slideshow ${post.postIndex}`)
        if (!postFolder) continue

        for (const slide of post.slides) {
          setProgress(`Rendering ${done + 1}/${totalSlides}...`)
          const dataUrl = await renderSlideToDataUrl(slide.layoutConfig)
          const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
          postFolder.file(`slide-${String(slide.slideNumber).padStart(2, '0')}.jpg`, base64, { base64: true })
          done++
        }
      }

      setProgress('Uploading to Drive...')
      const ideaSlug = sanitizeFilename(payload.ideaTitle)
      const uploadPromises = countries.map(async (country) => {
        const zip = countryZips.get(country)!
        const countryLabel = COUNTRY_LABELS[country as keyof typeof COUNTRY_LABELS] || country.toUpperCase()
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        const formData = new FormData()
        formData.append('file', zipBlob, `${ideaSlug}-${countryLabel}.zip`)
        formData.append('ideaTitle', payload.ideaTitle)
        formData.append('folderId', payload.folderId)
        return fetch(`/api/ideas/${ideaId}/export/drive-upload`, { method: 'POST', body: formData })
      })

      const uploadResults = await Promise.all(uploadPromises)
      const failed = uploadResults.filter((r) => !r.ok)
      if (failed.length > 0) {
        const d = await failed[0].json().catch(() => ({}))
        throw new Error(d.error || 'Upload failed')
      }

      const folderLink = `https://drive.google.com/drive/folders/${payload.folderId}`
      const msg = `Success! 4 country zips uploaded – View: ${folderLink}`
      setSuccess(msg)
      setProgress('')
      return { success: true, webViewLink: folderLink }
    } catch (err: any) {
      const msg = err.message || 'Export failed'
      setError(msg)
      setProgress('')
      return { success: false, error: msg }
    } finally {
      setIsExporting(false)
    }
  }, [ideaId])

  const exportToFlatZip = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsExporting(true)
    setError(null)
    setSuccess(null)
    setProgress('Preparing...')

    try {
      const prepareRes = await fetch(`/api/ideas/${ideaId}/export/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!prepareRes.ok) {
        const d = await prepareRes.json()
        throw new Error(d.error || 'Prepare failed')
      }

      const payload: ExportPreparePayload = await prepareRes.json()

      const countryOrder = new Map(COUNTRIES.map((country, index) => [country, index]))
      const orderedPosts = [...payload.posts].sort((a, b) => {
        const countryDiff = (countryOrder.get(a.country as any) ?? 999) - (countryOrder.get(b.country as any) ?? 999)
        if (countryDiff !== 0) return countryDiff
        if (a.postIndex !== b.postIndex) return a.postIndex - b.postIndex
        return a.personaType.localeCompare(b.personaType)
      })

      const totalSlides = orderedPosts.reduce((sum, post) => sum + post.slides.length, 0)
      const sequencePad = Math.max(4, String(Math.max(totalSlides, 1)).length)
      const maxPostIndex = orderedPosts.reduce((max, post) => Math.max(max, post.postIndex), 0)
      const postIndexPad = Math.max(2, String(Math.max(maxPostIndex, 1)).length)

      const zip = new JSZip()

      let done = 0
      let flatIndex = 1
      for (const post of orderedPosts) {
        const countryLabel = COUNTRY_LABELS[post.country as keyof typeof COUNTRY_LABELS] || post.country.toUpperCase()
        const safeCountryLabel = sanitizeFilename(countryLabel)
        const safePersonaLabel = sanitizeFilename(post.personaType)
        const postIndexLabel = String(post.postIndex).padStart(postIndexPad, '0')

        const orderedSlides = [...post.slides].sort((a, b) => a.slideNumber - b.slideNumber)
        for (const slide of orderedSlides) {
          setProgress(`Rendering ${done + 1}/${totalSlides}...`)
          const dataUrl = await renderSlideToDataUrl(slide.layoutConfig)
          const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
          const sequenceLabel = String(flatIndex).padStart(sequencePad, '0')
          const slideNumberLabel = String(slide.slideNumber).padStart(2, '0')
          const filename = `${sequenceLabel}-${safeCountryLabel}-${postIndexLabel}-${safePersonaLabel}-slide-${slideNumberLabel}.jpg`
          zip.file(filename, base64, { base64: true })
          flatIndex += 1
          done += 1
        }
      }

      setProgress('Zipping...')
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })

      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${sanitizeFilename(payload.ideaTitle)}-photos.zip`
      link.click()
      URL.revokeObjectURL(url)

      setProgress('Complete!')
      setTimeout(() => setProgress(''), 2000)
      return { success: true }
    } catch (err: any) {
      const msg = err.message || 'Export failed'
      setError(msg)
      setProgress('')
      return { success: false, error: msg }
    } finally {
      setIsExporting(false)
    }
  }, [ideaId])

  return { exportToDrive, exportToFlatZip, isExporting, progress, error, success }
}
