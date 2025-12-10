'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface DeleteIdeaButtonProps {
  ideaId: string
  ideaTitle: string
  onDelete?: () => void
}

export function DeleteIdeaButton({ ideaId, ideaTitle, onDelete }: DeleteIdeaButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/ideas/${ideaId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete idea')
      }

      // Wait a moment for database commit
      await new Promise(resolve => setTimeout(resolve, 200))

      // If onDelete callback provided, call it
      if (onDelete) {
        onDelete()
      } else {
        // Otherwise, redirect to ideas list
        window.location.href = '/ideas'
      }
    } catch (error: any) {
      console.error('Error deleting idea:', error)
      alert(`Failed to delete idea: ${error.message}`)
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  const handleCancel = () => {
    setShowConfirm(false)
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Delete &quot;{ideaTitle}&quot;?
        </span>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Confirm'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isDeleting}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      Delete
    </Button>
  )
}

