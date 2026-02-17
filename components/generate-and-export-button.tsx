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
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)

  const { exportToDrive, progress: exportProgress } = useClientExportToDrive(ideaId)

  const displayProgress = progress || exportProgress

  const downloadZip = async () => {
    setProgress('Downloading ZIP...')
    const response = await fetch(`/api/ideas/${ideaId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'ZIP export failed')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${ideaTitle.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-')}-export.zip`
    link.click()
    URL.revokeObjectURL(url)
  }

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

  const handleGenerateAndDownload = async () => {
    setIsProcessing(true)
    setError(null)
    setSuccess(null)
    setProgress('Generating posts...')

    try {
      const generateResponse = await fetch(`/api/ideas/${ideaId}/generate-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: replaceExisting }),
      })

      const generateData = await generateResponse.json()

      if (!generateData.success) {
        throw new Error(generateData.errors?.join(', ') || generateData.error || 'Failed to generate posts')
      }

      setProgress(`Generated ${generateData.totalPosts} posts. Building ZIP...`)
      await downloadZip()

      setProgress('')
      setSuccess('Downloaded ZIP!')
      router.refresh()
      setTimeout(() => setSuccess(null), 6000)
    } catch (err: any) {
      setError(err.message || 'Failed to generate and download')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleGenerateAndExport}
          disabled={isProcessing}
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
          onClick={handleGenerateAndDownload}
          disabled={isProcessing}
          variant="outline"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {displayProgress || 'Processing...'}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate & Download ZIP
            </>
          )}
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            className="rounded border-border"
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
