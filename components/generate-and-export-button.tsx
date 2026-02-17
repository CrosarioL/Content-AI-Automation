'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Download, Loader2, Sparkles } from 'lucide-react'
import { useClientExportToDrive } from '@/components/client-export-to-drive'

interface GenerateAndExportButtonProps {
  ideaId: string
  ideaTitle: string
}

export function GenerateAndExportButton({ ideaId, ideaTitle }: GenerateAndExportButtonProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState('')
  const [downloadProgress, setDownloadProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)

  const { exportToDrive, progress: exportProgress } = useClientExportToDrive(ideaId)

  const displayProgress = progress || exportProgress

  const sanitizeFilename = (name: string) =>
    name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-').slice(0, 50)

  const handleGenerateAndExport = async () => {
    setIsProcessing(true)
    setError(null)
    setSuccess(null)
    setProgress('Generating posts...')

    try {
      // Step 1: Generate posts (replaceExisting = force: delete existing and regenerate)
      const generateResponse = await fetch(`/api/ideas/${ideaId}/generate-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: replaceExisting }),
      })

      const generateData = await generateResponse.json()

      if (!generateData.success) {
        throw new Error(generateData.errors?.join(', ') || generateData.error || 'Failed to generate posts')
      }

      setProgress(`Generated ${generateData.totalPosts} posts. Rendering slides...`)

      // Step 2: Client-side export (renders in browser = exact font match) then upload to Drive
      const result = await exportToDrive()

      if (result.success && result.webViewLink) {
        setSuccess(`Success! View: ${result.webViewLink}`)
        router.refresh()
      } else if (result.error) {
        setError(result.error)
      }
      setProgress('')
      setTimeout(() => setSuccess(null), 8000)
    } catch (err: any) {
      setError(err.message || 'Failed to generate and export')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadFlatZip = async () => {
    setIsDownloading(true)
    setError(null)
    setSuccess(null)
    setDownloadProgress('Preparing...')

    try {
      const response = await fetch(`/api/ideas/${ideaId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flat: true }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Download failed')
      }

      setDownloadProgress('Downloading...')
      const blob = await response.blob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${sanitizeFilename(ideaTitle)}-photos.zip`
      link.click()
      URL.revokeObjectURL(url)

      setDownloadProgress('Complete!')
      setTimeout(() => setDownloadProgress(''), 2000)
    } catch (err: any) {
      setDownloadProgress('')
      setError(err.message || 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Button
          onClick={handleGenerateAndExport}
          disabled={isProcessing || isDownloading}
          variant="default"
        >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {displayProgress || 'Processing...'}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate & Export to Drive
          </>
        )}
      </Button>
        <Button
          onClick={handleDownloadFlatZip}
          disabled={isProcessing || isDownloading}
          variant="outline"
        >
          {isDownloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {downloadProgress || 'Downloading...'}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Photos (Flat ZIP)
            </>
          )}
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            className="rounded border-border"
            disabled={isProcessing || isDownloading}
          />
          Replace existing
        </label>
      </div>
      {error && (
        <p className="text-sm text-rose-600 max-w-md text-right">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 max-w-md text-right">
          {success}
          {success.includes('View:') && (
            <a 
              href={success.split('View: ')[1]} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 underline"
            >
              Open
            </a>
          )}
        </p>
      )}
    </div>
  )
}
