import { NextRequest, NextResponse } from 'next/server'
import { getRenderJobs } from '@/lib/db'

export const maxDuration = 300 // Allow up to 5 minutes for batch processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 5 // Process up to 5 jobs at a time
    const useRealRenderer = body.useRealRenderer !== false // Default to real renderer

    // Get queued jobs
    const queuedJobs = await getRenderJobs({ status: 'queued' })
    const jobsToProcess = queuedJobs.slice(0, limit)

    if (jobsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No queued jobs to process',
        processed: 0,
      })
    }

    const results: Array<{
      jobId: string
      success: boolean
      error?: string
    }> = []

    // Process each job
    for (const job of jobsToProcess) {
      try {
        // Call the render process endpoint
        const endpoint = useRealRenderer
          ? `${getBaseUrl(request)}/api/render/process`
          : `${getBaseUrl(request)}/api/render/mock`

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId: job.id }),
        })

        const data = await response.json()

        results.push({
          jobId: job.id,
          success: response.ok,
          error: response.ok ? undefined : data.error,
        })
      } catch (err: any) {
        results.push({
          jobId: job.id,
          success: false,
          error: err.message,
        })
      }
    }

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful,
      failed,
      results,
    })
  } catch (error: any) {
    console.error('[process-queue] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to process queue',
      },
      { status: 500 }
    )
  }
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}

