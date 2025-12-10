'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PauseCircle, PlayCircle, RotateCw } from 'lucide-react'

interface QueueRefreshControlsProps {
  intervalMs?: number
}

export function QueueRefreshControls({ intervalMs = 10000 }: QueueRefreshControlsProps) {
  const router = useRouter()
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [autoRefresh, intervalMs, router])

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.refresh()}
        className="flex items-center gap-1.5"
      >
        <RotateCw className="h-4 w-4" />
        Refresh
      </Button>
      <Button
        type="button"
        variant={autoRefresh ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setAutoRefresh((prev) => !prev)}
        className="flex items-center gap-1.5"
      >
        {autoRefresh ? (
          <>
            <PauseCircle className="h-4 w-4" />
            Auto: On
          </>
        ) : (
          <>
            <PlayCircle className="h-4 w-4" />
            Auto: Off
          </>
        )}
      </Button>
    </div>
  )
}

