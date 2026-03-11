'use client'

type PrepareImageOptions = {
  /**
   * If the image's longest edge is larger than this, it will be downscaled.
   * Keeps uploads small and avoids server/proxy size limits.
   */
  maxLongEdge?: number
  /** If file bytes exceed this, it will be re-encoded (and may be converted to JPEG). */
  maxBytes?: number
  /** JPEG quality (0..1) when encoding JPEG. */
  jpegQuality?: number
  /** Background fill used when flattening to JPEG. */
  flattenBackground?: string
}

function renameExtension(name: string, extWithDot: '.png' | '.jpg'): string {
  const safe = (name || 'upload').trim() || 'upload'
  const base = safe.replace(/\.[^/.]+$/, '')
  return `${base}${extWithDot}`
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/png' | 'image/jpeg',
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to encode image'))
        resolve(blob)
      },
      type,
      quality
    )
  })
}

async function decodeImage(file: File): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close?.(),
    }
  }

  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  img.src = url

  try {
    if (typeof img.decode === 'function') {
      await img.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to decode image'))
      })
    }
  } finally {
    // We can revoke after decode/load, image keeps decoded data.
    URL.revokeObjectURL(url)
  }

  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    cleanup: () => {},
  }
}

export async function prepareImageFileForUpload(
  file: File,
  options: PrepareImageOptions = {}
): Promise<File> {
  const maxLongEdge = options.maxLongEdge ?? 2560
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024
  const jpegQuality = options.jpegQuality ?? 0.9
  const flattenBackground = options.flattenBackground ?? '#ffffff'

  if (!file.type || !file.type.startsWith('image/')) return file

  let decoded:
    | {
        source: CanvasImageSource
        width: number
        height: number
        cleanup: () => void
      }
    | undefined

  try {
    decoded = await decodeImage(file)

    const { source, width, height } = decoded
    const longEdge = Math.max(width, height)
    const needsResize = longEdge > maxLongEdge
    const isPng = file.type === 'image/png'
    const isJpeg = file.type === 'image/jpeg'

    // If already small + compatible, keep original (fast path).
    if (!needsResize && file.size <= maxBytes && (isPng || isJpeg)) {
      return file
    }

    const scale = needsResize ? maxLongEdge / longEdge : 1
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH

    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    // Canva exports (especially PNG) can be huge; when over maxBytes we flatten to JPEG.
    const flattenToJpeg = !isJpeg && (file.size > maxBytes || !isPng)
    const outType: 'image/png' | 'image/jpeg' = flattenToJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/jpeg'

    if (outType === 'image/jpeg') {
      ctx.fillStyle = flattenBackground
      ctx.fillRect(0, 0, targetW, targetH)
    }

    ctx.drawImage(source, 0, 0, targetW, targetH)

    const blob =
      outType === 'image/jpeg'
        ? await canvasToBlob(canvas, outType, jpegQuality)
        : await canvasToBlob(canvas, outType)

    const outName = outType === 'image/png'
      ? renameExtension(file.name, '.png')
      : renameExtension(file.name, '.jpg')

    return new File([blob], outName, { type: outType, lastModified: file.lastModified })
  } catch {
    return file
  } finally {
    decoded?.cleanup()
  }
}

