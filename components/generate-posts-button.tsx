'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'

interface GeneratePostsButtonProps {
  ideaId: string
}

export function GeneratePostsButton({ ideaId }: GeneratePostsButtonProps) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [forceMode, setForceMode] = useState(false)
  const [result, setResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setResult(null)

    try {
      const response = await fetch(`/api/ideas/${ideaId}/generate-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: forceMode }),
      })

      const data = await response.json()

      if (data.success) {
        setResult({
          type: 'success',
          message: `Generated ${data.totalPosts} posts`,
        })
        router.refresh()
      } else {
        setResult({
          type: 'error',
          message: data.errors?.join(', ') || data.error || 'Failed to generate',
        })
      }
    } catch (err: any) {
      setResult({
        type: 'error',
        message: err.message || 'Failed to generate posts',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          variant="default"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate 28 Posts
            </>
          )}
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={forceMode}
            onChange={(e) => setForceMode(e.target.checked)}
            className="rounded border-border"
          />
          Regenerate all
        </label>
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

