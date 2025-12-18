import { NextRequest, NextResponse } from 'next/server'
import { deleteRenderJob, getRenderJobById } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id
    
    // Get current job to validate it exists
    const job = await getRenderJobById(jobId)
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    // Don't allow deleting jobs that are in progress
    if (['generating', 'encoding', 'uploading'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot delete job with status: ${job.status}` },
        { status: 400 }
      )
    }
    
    await deleteRenderJob(jobId)
    
    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    console.error('[delete-job] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete job' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await getRenderJobById(params.id)
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(job)
  } catch (error: any) {
    console.error('[get-job] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to get job' },
      { status: 500 }
    )
  }
}

