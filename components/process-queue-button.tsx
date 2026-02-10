'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlayCircle, Loader2 } from 'lucide-react'

interface ProcessQueueButtonProps {
  queuedCount: number
}

export function ProcessQueueButton({ queuedCount }: ProcessQueueButtonProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleProcessQueue = async (useRealRenderer: boolean) => {
    setIsProcessing(true)
    setResult(null)

    try {
      const response = await fetch('/api/render/process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 5,
          useRealRenderer,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          type: 'success',
          message: `Processed ${data.successful} of ${data.processed} jobs`,
        })
        router.refresh()
      } else {
        setResult({
          type: 'error',
          message: data.error || 'Failed to process queue',
        })
      }
    } catch (err: any) {
      setResult({
        type: 'error',
        message: err.message || 'Failed to process queue',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (queuedCount === 0) {
    return null
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleProcessQueue(false)}
          disabled={isProcessing}
          title="Quick test with placeholder images"
        >
          {isProcessing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="mr-1.5 h-4 w-4" />
          )}
          Mock Render ({queuedCount})
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => handleProcessQueue(true)}
          disabled={isProcessing}
          title="Full render with Puppeteer + FFmpeg (slower)"
        >
          {isProcessing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="mr-1.5 h-4 w-4" />
          )}
          Render Queue ({queuedCount})
        </Button>
      </div>
      {result && (
        <p
          className={`text-sm ${
            result.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  )
}

