'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Download, FolderArchive, Upload } from 'lucide-react'

interface ExportZipButtonProps {
  ideaId: string
  ideaTitle: string
}

export function ExportZipButton({ ideaId, ideaTitle }: ExportZipButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleExport = async (uploadToDrive = false) => {
    setIsExporting(true)
    setError(null)
    setSuccess(null)
    setProgress('Preparing export...')

    try {
      const endpoint = uploadToDrive 
        ? `/api/ideas/${ideaId}/export/drive`
        : `/api/ideas/${ideaId}/export`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Export failed')
      }

      if (uploadToDrive) {
        // Handle Google Drive upload response
        const data = await response.json()
        setProgress('Uploaded to Google Drive!')
        setSuccess(`Uploaded! View: ${data.webViewLink}`)
        setTimeout(() => {
          setProgress('')
          setSuccess(null)
        }, 5000)
      } else {
        // Handle ZIP download
        setProgress('Downloading...')
        const blob = await response.blob()
        
        // Create download link
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${ideaTitle.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-')}-export.zip`
        link.click()
        URL.revokeObjectURL(url)
        
        setProgress('Complete!')
        setTimeout(() => setProgress(''), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button
          onClick={() => handleExport(false)}
          disabled={isExporting}
          variant="outline"
        >
          {isExporting && !progress.includes('Drive') ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {progress || 'Exporting...'}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download ZIP
            </>
          )}
        </Button>
        <Button
          onClick={() => handleExport(true)}
          disabled={isExporting}
          variant="outline"
        >
          {isExporting && progress.includes('Drive') ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {progress || 'Uploading...'}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload to Drive
            </>
          )}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">
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

