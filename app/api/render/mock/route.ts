import { NextRequest, NextResponse } from 'next/server'
import { runMockRenderJobs } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const jobIds = Array.isArray(body?.jobIds) ? (body.jobIds as string[]) : undefined
    const processed = await runMockRenderJobs(jobIds)

    return NextResponse.json(
      {
        success: true,
        processed: processed.length,
        jobs: processed,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[mock-renderer] Failed to process jobs:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to run mock renderer',
      },
      { status: 500 }
    )
  }
}

