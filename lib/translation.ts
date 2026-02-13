import { decodeHtmlEntities } from './utils'

export async function translateText(text: string, targetLang: 'ar' | 'ms'): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) {
    console.warn('GOOGLE_TRANSLATE_API_KEY not set, skipping translation')
    return text
  }
  
  try {
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
    const raw = data.data.translations[0].translatedText || text
    return decodeHtmlEntities(raw)
  } catch (error) {
    console.error('Translation error:', error)
    return text
  }
}
