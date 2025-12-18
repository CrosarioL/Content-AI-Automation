'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RotateCw, Trash2, Loader2 } from 'lucide-react'
import type { JobStatus } from '@/types'

interface JobActionsProps {
  jobId: string
  status: JobStatus
  onDelete?: () => void
}

export function JobActions({ jobId, status, onDelete }: JobActionsProps) {
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const canRetry = status === 'failed' || status === 'complete'
  const canDelete = !['generating', 'encoding', 'uploading'].includes(status)

  const handleRetry = async () => {
    if (!canRetry) return
    
    setIsRetrying(true)
    try {
      const response = await fetch(`/api/queue/${jobId}/retry`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data?.error || 'Failed to retry job')
      }
      
      router.refresh()
    } catch (error) {
      console.error('Failed to retry job:', error)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleDelete = async () => {
    if (!canDelete) return
    if (!confirm('Are you sure you want to delete this job?')) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/queue/${jobId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data?.error || 'Failed to delete job')
      }
      
      router.refresh()
      onDelete?.()
    } catch (error) {
      console.error('Failed to delete job:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {canRetry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying}
          title="Retry job"
        >
          {isRetrying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="h-4 w-4" />
          )}
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete job"
          className="text-destructive hover:text-destructive"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  )
}

