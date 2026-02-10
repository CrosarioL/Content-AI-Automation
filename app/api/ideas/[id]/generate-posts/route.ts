import { NextRequest, NextResponse } from 'next/server'
import { generatePostsForIdea } from '@/lib/generator'
import type { Persona } from '@/types'

export const maxDuration = 60 // Allow up to 60 seconds for generation

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ideaId = params.id
    const body = await request.json().catch(() => ({}))
    
    const personas = body.personas as Persona[] | undefined
    const force = Boolean(body.force)

    const result = await generatePostsForIdea({
      ideaId,
      personas,
      force,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          errors: result.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      totalPosts: result.totalPosts,
      postsByPersona: result.postsByPersona,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error: any) {
    console.error('[generate-posts] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate posts',
      },
      { status: 500 }
    )
  }
}

