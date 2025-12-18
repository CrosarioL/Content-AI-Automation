import { NextRequest, NextResponse } from 'next/server'
import { updateRenderJobStatus, getRenderJobById, runMockRenderJobs } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    
    // Get current job
    const job = await getRenderJobById(jobId)
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    // Only allow retrying failed or complete jobs
    if (!['failed', 'complete'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot retry job with status: ${job.status}` },
        { status: 400 }
      )
    }
    
    // Reset job to queued status
    await updateRenderJobStatus(jobId, 'queued', {
      errorMessage: undefined,
      outputUrl: null,
    })
    
    // Run mock render (in production, this would queue for real rendering)
    await runMockRenderJobs([jobId])
    
    // Get updated job
    const updatedJob = await getRenderJobById(jobId)
    
    return NextResponse.json({
      success: true,
      job: updatedJob,
    })
  } catch (error: any) {
    console.error('[retry-job] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to retry job' },
      { status: 500 }
    )
  }
}

