import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { supabaseServer } from './supabase'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Set FFmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}

const SLIDE_DURATION = 4 // seconds per slide
const VIDEO_WIDTH = 1080
const VIDEO_HEIGHT = 1920
const VIDEO_FPS = 30

export interface CompileVideoOptions {
  slideImages: Array<{
    slideNumber: number
    imageBuffer: Buffer
  }>
  outputFilename: string
  slideDuration?: number // seconds per slide
  ideaId: string
  persona: string
  country: string
}

export interface CompileVideoResult {
  success: boolean
  videoBuffer?: Buffer
  storagePath?: string
  publicUrl?: string
  error?: string
}

export async function compileVideo(options: CompileVideoOptions): Promise<CompileVideoResult> {
  const {
    slideImages,
    outputFilename,
    slideDuration = SLIDE_DURATION,
    ideaId,
    persona,
    country,
  } = options

  // Create temp directory for processing
  const tempDir = path.join(os.tmpdir(), `video-${Date.now()}`)
  
  try {
    fs.mkdirSync(tempDir, { recursive: true })

    // Write slide images to temp directory
    const imagePaths: string[] = []
    for (const slide of slideImages) {
      const imagePath = path.join(tempDir, `slide-${String(slide.slideNumber).padStart(3, '0')}.png`)
      fs.writeFileSync(imagePath, slide.imageBuffer)
      imagePaths.push(imagePath)
    }

    // Create a concat file for FFmpeg
    const concatContent = imagePaths
      .map((p) => `file '${p.replace(/\\/g, '/')}'
duration ${slideDuration}`)
      .join('\n')
    
    // Add last image again (FFmpeg concat filter quirk)
    const lastImage = imagePaths[imagePaths.length - 1]
    const concatFile = path.join(tempDir, 'concat.txt')
    fs.writeFileSync(concatFile, concatContent + `\nfile '${lastImage?.replace(/\\/g, '/')}'`)

    const outputPath = path.join(tempDir, outputFilename)

    // Compile video using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          `-vf scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-r', String(VIDEO_FPS),
          '-movflags', '+faststart',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    // Read compiled video
    const videoBuffer = fs.readFileSync(outputPath)

    // Upload to Supabase storage
    const bucket = process.env.SLIDE_ASSETS_BUCKET || 'slide-assets'
    const storagePath = `videos/${ideaId}/${persona}-${country}/${outputFilename}`

    const { data, error } = await supabaseServer.storage
      .from(bucket)
      .upload(storagePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      })

    if (error) {
      return {
        success: false,
        error: `Failed to upload video: ${error.message}`,
      }
    }

    // Get public URL
    const { data: urlData } = supabaseServer.storage
      .from(bucket)
      .getPublicUrl(storagePath)

    return {
      success: true,
      videoBuffer,
      storagePath: data.path,
      publicUrl: urlData.publicUrl,
    }
  } catch (err: any) {
    console.error('Video compilation failed:', err)
    return {
      success: false,
      error: err.message || 'Video compilation failed',
    }
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Compile video from already-rendered slide URLs
export async function compileVideoFromUrls(options: {
  slideUrls: Array<{
    slideNumber: number
    url: string
  }>
  outputFilename: string
  slideDuration?: number
  ideaId: string
  persona: string
  country: string
}): Promise<CompileVideoResult> {
  const { slideUrls, ...rest } = options

  // Download all slide images
  const slideImages: Array<{ slideNumber: number; imageBuffer: Buffer }> = []
  
  for (const slide of slideUrls) {
    try {
      const response = await fetch(slide.url)
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to download slide ${slide.slideNumber}: ${response.statusText}`,
        }
      }
      const arrayBuffer = await response.arrayBuffer()
      slideImages.push({
        slideNumber: slide.slideNumber,
        imageBuffer: Buffer.from(arrayBuffer),
      })
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to download slide ${slide.slideNumber}: ${err.message}`,
      }
    }
  }

  return compileVideo({ ...rest, slideImages })
}

