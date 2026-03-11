import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Decode HTML entities in translated text so symbols like >>> stay correct
 * (Google Translate returns &gt;&gt;&gt; for >>> and similar for other symbols/emojis).
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return text
  return text
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

export async function getErrorMessageFromResponse(response: Response): Promise<string> {
  const statusLine = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const data = (await response.json()) as any
      if (typeof data === 'string') return data
      if (data && typeof data === 'object') {
        if (typeof data.error === 'string' && data.error.trim()) return data.error
        if (typeof data.message === 'string' && data.message.trim()) return data.message
      }
      return statusLine
    } catch {
      // fall through to text parsing
    }
  }

  try {
    const text = await response.text()
    const compact = text.replace(/\s+/g, ' ').trim()
    if (compact) return `${statusLine}: ${compact.slice(0, 240)}`
  } catch {
    // ignore
  }

  return statusLine
}
