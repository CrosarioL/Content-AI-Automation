import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang } = await request.json()
    
    if (!text || !targetLang) {
      return NextResponse.json(
        { error: 'Missing text or targetLang' },
        { status: 400 }
      )
    }
    
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Translation API key not configured' },
        { status: 500 }
      )
    }
    
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          target: targetLang,
          source: 'en',
        }),
      }
    )
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    const translatedText = data.data.translations[0].translatedText || text
    
    return NextResponse.json({ translatedText })
  } catch (error: any) {
    console.error('Translation error:', error)
    return NextResponse.json(
      { error: error.message || 'Translation failed' },
      { status: 500 }
    )
  }
}
