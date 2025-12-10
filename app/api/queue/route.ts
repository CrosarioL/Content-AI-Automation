import { NextRequest, NextResponse } from 'next/server'
import { getRenderJobs } from '@/lib/db'
import type { JobPriority, JobStatus } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const priorityParam = url.searchParams.get('priority')
    const ideaId = url.searchParams.get('ideaId') || undefined

    const filters: {
      status?: JobStatus
      priority?: JobPriority
      ideaId?: string
    } = {}

    if (statusParam && statusParam !== 'all') {
      filters.status = statusParam as JobStatus
    }
    if (priorityParam && priorityParam !== 'all') {
      filters.priority = priorityParam as JobPriority
    }
    if (ideaId) {
      filters.ideaId = ideaId
    }

    const jobs = await getRenderJobs(filters)

    return NextResponse.json({
      success: true,
      count: jobs.length,
      jobs,
    })
  } catch (error: any) {
    console.error('[queue] Failed to fetch render jobs:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch queue' },
      { status: 500 }
    )
  }
}

