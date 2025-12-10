import { NextRequest, NextResponse } from 'next/server'
import { createIdea } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.category) {
      return NextResponse.json(
        { error: 'Title and category are required' },
        { status: 400 }
      )
    }

    if (!body.personas || !Array.isArray(body.personas) || body.personas.length === 0) {
      return NextResponse.json(
        { error: 'At least one persona is required' },
        { status: 400 }
      )
    }

    // Create the idea with all related data
    const idea = await createIdea({
      title: body.title,
      category: body.category,
      description: body.description,
      personas: body.personas,
    })

    return NextResponse.json({ idea }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating idea:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create idea' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { getIdeas } = await import('@/lib/db')
    const ideas = await getIdeas()
    return NextResponse.json({ ideas }, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching ideas:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ideas' },
      { status: 500 }
    )
  }
}

