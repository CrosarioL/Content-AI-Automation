'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface GenerateJobsButtonProps {
  ideaId: string
}

export function GenerateJobsButton({ ideaId }: GenerateJobsButtonProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [forceMode, setForceMode] = useState(false)

  const handleGenerate = async () => {
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/ideas/${ideaId}/generate-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: forceMode }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate jobs')
      }

      const created = payload.jobsCreated || 0
      const skipped = payload.skipped || 0
      const text =
        skipped > 0
          ? `Created ${created} job${created === 1 ? '' : 's'} (skipped ${skipped} existing)`
          : `Created ${created} job${created === 1 ? '' : 's'}`

      setMessage({
        type: 'success',
        text,
      })

      setTimeout(() => {
        router.push('/queue')
      }, 400)
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to generate jobs',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <Button onClick={handleGenerate} disabled={isSubmitting}>
          {isSubmitting ? 'Generating...' : 'Generate Render Jobs'}
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={forceMode}
            onChange={(e) => setForceMode(e.target.checked)}
            className="rounded border-border"
          />
          Force re-render
        </label>
      </div>
      {message && (
        <p
          className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}

