import { NextRequest, NextResponse } from 'next/server'
import { postToSocial, getPostingConfigStatus, type SocialPlatform } from '@/lib/social-posting'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { platform, videoUrl, caption, hashtags } = body

    if (!platform || !videoUrl) {
      return NextResponse.json(
        { error: 'platform and videoUrl are required' },
        { status: 400 }
      )
    }

    const result = await postToSocial({
      platform: platform as SocialPlatform,
      videoUrl,
      caption: caption || '',
      hashtags: hashtags || [],
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        postId: result.postId,
        postUrl: result.postUrl,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          status: result.status,
        },
        { status: result.status === 'not_configured' ? 503 : 500 }
      )
    }
  } catch (error: any) {
    console.error('[post] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to post' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return configuration status for platforms
  const status = getPostingConfigStatus()
  
  return NextResponse.json({
    platforms: {
      tiktok: {
        configured: status.tiktok,
        name: 'TikTok',
        setupUrl: 'https://developers.tiktok.com/',
      },
      instagram: {
        configured: status.instagram,
        name: 'Instagram',
        setupUrl: 'https://developers.facebook.com/docs/instagram-api/',
      },
    },
  })
}

