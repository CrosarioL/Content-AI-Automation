import { NextRequest, NextResponse } from 'next/server'
import { createRenderJobsForIdea, getIdeaWithDetails } from '@/lib/db'
import type { JobPriority } from '@/types'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ideaId = params.id
    const body = await request.json().catch(() => ({}))
    const priority = body?.priority as JobPriority | undefined
    const batchId = body?.batchId as string | undefined
    const force = Boolean(body?.force)

    const idea = await getIdeaWithDetails(ideaId)
    const personaCount = idea.personas?.length || 0
    const combinationCount = (idea.personas || []).reduce(
      (acc, persona) => acc + (persona.countries?.length || 0),
      0
    )

    if (personaCount === 0 || combinationCount === 0) {
      return NextResponse.json(
        { error: 'Idea must have at least one persona and country configured' },
        { status: 400 }
      )
    }

    const result = await createRenderJobsForIdea(ideaId, {
      priority,
      batchId,
      force,
    })

    return NextResponse.json({
      success: true,
      jobsCreated: result.jobsCreated,
      jobs: result.jobs,
      batchId: result.batchId,
      skipped: force ? 0 : combinationCount - result.jobsCreated,
    })
  } catch (error: any) {
    console.error('[generate-jobs] Error:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Failed to generate render jobs',
      },
      { status: 500 }
    )
  }
}

