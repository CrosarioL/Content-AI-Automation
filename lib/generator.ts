/**
 * Mass Post Generator
 * 
 * Generates 7 unique post combinations per country per persona.
 * Uses diversity-first selection to maximize variety.
 * Total: 7 posts × 4 countries = 28 posts per persona.
 */

import { createHash } from 'crypto'
import {
  createPostInstance,
  getExistingComboKeys,
  getExistingPostIndexes,
  deletePostInstancesForIdea,
  getIdeaWithDetailsV2,
} from './db'
import type {
  Persona,
  Country,
  PostChoices,
  PostInstance,
  IdeaWithDetailsV2,
  PersonaSlideWithPools,
} from '@/types'

// 7 posts per country for maximum variety (7 × 4 countries = 28 posts per persona)
const POSTS_PER_COUNTRY = 7
const COUNTRIES: Country[] = ['uk', 'us', 'ksa', 'my']

// ============================================
// Types
// ============================================

interface SlideChoice {
  slide_number: number
  image_id?: string // ID of chosen image from pool (if any)
  text_variant_index: 1 | 2 // Which text variant was chosen
}

interface SlideOptions {
  slide_number: number
  slide_type: string
  imageIds: Array<string | undefined>
  textIndices: (1 | 2)[]
}

interface ComboVector {
  choices: SlideChoice[]
  key: string // hash of the choice vector
}

// ============================================
// Helpers
// ============================================

function generateComboKey(choices: SlideChoice[]): string {
  const str = choices
    .map((c) => `${c.slide_number}:${c.image_id || 'none'}:${c.text_variant_index}`)
    .join('|')
  return createHash('md5').update(str).digest('hex').slice(0, 16)
}

function generateSeed(ideaId: string, persona: Persona, country: Country, timestamp: number): string {
  return createHash('md5')
    .update(`${ideaId}-${persona}-${country}-${timestamp}`)
    .digest('hex')
    .slice(0, 16)
}

// Simple seeded PRNG (Mulberry32)
function seededRandom(seed: string): () => number {
  let h = parseInt(seed.slice(0, 8), 16)
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
    h ^= h >>> 16
    return (h >>> 0) / 0xffffffff
  }
}

// Shuffle array with seeded random
function shuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function buildSlideOptions(slides: PersonaSlideWithPools[], country: Country): SlideOptions[] {
  return slides.map((slide) => {
    const imageIds = slide.image_pools.map((img) => img.id).filter(Boolean)
    const normalizedImageIds = imageIds.length > 0 ? imageIds : [undefined]

    // Only use text variants for this country
    const textPools = slide.text_pools.filter((t) => t.country === country)
    const textIndices = textPools.length > 0
      ? [...new Set(textPools.map((t) => t.variant_index as 1 | 2))]
      : [1]

    return {
      slide_number: slide.slide_number,
      slide_type: slide.slide_type,
      imageIds: normalizedImageIds,
      textIndices,
    }
  })
}

function buildHookAssignments(
  slideOptions: SlideOptions[],
  count: number,
  random: () => number
): Map<number, { imageIds: Array<string | undefined>; textIndices: (1 | 2)[] }> {
  const assignments = new Map<number, { imageIds: Array<string | undefined>; textIndices: (1 | 2)[] }>()
  const hookSlides = slideOptions.filter((opt) => opt.slide_type === 'hook')
  if (hookSlides.length === 0 || count <= 0) return assignments

  for (const hook of hookSlides) {
    const uniqueImages = hook.imageIds.filter(Boolean) as string[]
    let imageOrder: Array<string | undefined> = Array(count).fill(undefined)
    if (uniqueImages.length > 0) {
      const shuffledImages = shuffle(uniqueImages, random)
      if (shuffledImages.length >= count) {
        imageOrder = shuffledImages.slice(0, count)
      } else {
        imageOrder = Array.from({ length: count }, (_, i) => shuffledImages[i % shuffledImages.length])
      }
    }

    const textVariants = [...hook.textIndices].sort((a, b) => a - b)
    const textOrder = Array.from({ length: count }, (_, i) => textVariants[i % textVariants.length])

    assignments.set(hook.slide_number, {
      imageIds: imageOrder,
      textIndices: textOrder,
    })
  }

  return assignments
}

function applyHookOverrides(
  selected: ComboVector[],
  hookAssignments: Map<number, { imageIds: Array<string | undefined>; textIndices: (1 | 2)[] }>
): void {
  if (hookAssignments.size === 0) return
  for (let i = 0; i < selected.length; i++) {
    const combo = selected[i]
    for (const [slideNumber, assignment] of hookAssignments.entries()) {
      const choice = combo.choices.find((c) => c.slide_number === slideNumber)
      if (!choice) continue
      const imageId = assignment.imageIds[i]
      const textIndex = assignment.textIndices[i]
      if (imageId !== undefined) choice.image_id = imageId
      if (textIndex !== undefined) choice.text_variant_index = textIndex
    }
    combo.key = generateComboKey(combo.choices)
  }
}

function mutateComboForUniqueness(
  combo: ComboVector,
  slideOptions: SlideOptions[],
  random: () => number,
  hookSlideNumbers: Set<number>
): boolean {
  const mutableOptions = slideOptions.filter((opt) => !hookSlideNumbers.has(opt.slide_number))
  if (mutableOptions.length === 0) return false
  const target = mutableOptions[Math.floor(random() * mutableOptions.length)]
  const choice = combo.choices.find((c) => c.slide_number === target.slide_number)
  if (!choice) return false

  const pickDifferent = <T,>(current: T, options: T[]) => {
    if (options.length <= 1) return current
    let next = current
    let attempts = 0
    while (next === current && attempts < 4) {
      next = options[Math.floor(random() * options.length)]
      attempts += 1
    }
    return next
  }

  choice.image_id = pickDifferent(choice.image_id, target.imageIds)
  choice.text_variant_index = pickDifferent(choice.text_variant_index, target.textIndices)
  return true
}

// Calculate "distance" between two combo vectors (hamming-like)
function comboDistance(a: SlideChoice[], b: SlideChoice[]): number {
  let dist = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i].image_id !== b[i].image_id) dist += 1
    if (a[i].text_variant_index !== b[i].text_variant_index) dist += 1
  }
  return dist
}

// Calculate minimum distance from a combo to a set of already-selected combos
function minDistanceToSet(combo: SlideChoice[], selected: SlideChoice[][]): number {
  if (selected.length === 0) return Infinity
  return Math.min(...selected.map((s) => comboDistance(combo, s)))
}

// ============================================
// Generator Core
// ============================================

interface GenerateOptions {
  ideaId: string
  persona: Persona
  country: Country
  slides: PersonaSlideWithPools[]
  existingKeys: Set<string>
  existingPostIndexes: Set<number>
  timestamp: number
}

function generateCandidateCombos(
  slideOptions: SlideOptions[],
  random: () => number,
  limit: number = 1000
): ComboVector[] {
  const candidates: ComboVector[] = []
  
  // Generate random candidates
  for (let i = 0; i < limit; i++) {
    const choices: SlideChoice[] = slideOptions.map((opt) => ({
      slide_number: opt.slide_number,
      image_id: opt.imageIds[Math.floor(random() * opt.imageIds.length)] || undefined,
      text_variant_index: opt.textIndices[Math.floor(random() * opt.textIndices.length)],
    }))
    
    const key = generateComboKey(choices)
    
    // Avoid duplicates in candidates
    if (!candidates.some((c) => c.key === key)) {
      candidates.push({ choices, key })
    }
  }
  
  return candidates
}

function selectDiverseCombos(
  candidates: ComboVector[],
  existingKeys: Set<string>,
  count: number
): ComboVector[] {
  const selected: ComboVector[] = []
  const selectedChoices: SlideChoice[][] = []
  
  // Filter out existing keys
  const available = candidates.filter((c) => !existingKeys.has(c.key))
  
  if (available.length === 0) {
    return []
  }
  
  // Greedy selection: always pick the candidate with max min-distance to already selected
  while (selected.length < count && available.length > 0) {
    let bestIdx = 0
    let bestScore = -1
    
    for (let i = 0; i < available.length; i++) {
      const dist = minDistanceToSet(available[i].choices, selectedChoices)
      if (dist > bestScore) {
        bestScore = dist
        bestIdx = i
      }
    }
    
    const chosen = available[bestIdx]
    selected.push(chosen)
    selectedChoices.push(chosen.choices)
    available.splice(bestIdx, 1)
  }
  
  return selected
}

async function generatePostsForCountry(options: GenerateOptions): Promise<PostInstance[]> {
  const { ideaId, persona, country, slides, existingKeys, existingPostIndexes, timestamp } = options
  
  const seed = generateSeed(ideaId, persona, country, timestamp)
  const random = seededRandom(seed)

  const slideOptions = buildSlideOptions(slides, country)
  
  // Generate candidate combinations
  const candidates = generateCandidateCombos(slideOptions, random, 500)
  
  // How many slots are available (1..POSTS_PER_COUNTRY)
  const availableIndexes = [1, 2, 3, 4, 5, 6, 7].filter((i) => !existingPostIndexes.has(i))
  const slotsToFill = Math.min(availableIndexes.length, POSTS_PER_COUNTRY - existingPostIndexes.size)
  
  const hookAssignments = buildHookAssignments(slideOptions, slotsToFill, random)
  const hookSlideNumbers = new Set(Array.from(hookAssignments.keys()))

  const selected = selectDiverseCombos(candidates, existingKeys, slotsToFill)
  applyHookOverrides(selected, hookAssignments)
  const usedKeys = new Set(existingKeys)
  for (const combo of selected) {
    combo.key = generateComboKey(combo.choices)
    let attempts = 0
    while (usedKeys.has(combo.key) && attempts < 6) {
      const mutated = mutateComboForUniqueness(combo, slideOptions, random, hookSlideNumbers)
      if (!mutated) break
      combo.key = generateComboKey(combo.choices)
      attempts += 1
    }
    usedKeys.add(combo.key)
  }
  
  const posts: PostInstance[] = []
  
  for (let i = 0; i < selected.length; i++) {
    const combo = selected[i]
    const postIndex = availableIndexes[i]
    
    const postChoices: PostChoices = {
      slides: combo.choices,
    }
    
    const post = await createPostInstance({
      idea_id: ideaId,
      persona_type: persona,
      country,
      post_index: postIndex,
      seed,
      combo_key: combo.key,
      choices: postChoices,
    })
    
    posts.push(post)
  }
  
  return posts
}

// ============================================
// Public API
// ============================================

export interface GeneratePostsOptions {
  ideaId: string
  personas?: Persona[] // If not provided, generate for all active personas
  force?: boolean // Delete existing posts and regenerate
}

export interface GeneratePostsResult {
  success: boolean
  totalPosts: number
  postsByPersona: Record<Persona, Record<Country, number>>
  errors: string[]
}

export async function generatePostsForIdea(
  options: GeneratePostsOptions
): Promise<GeneratePostsResult> {
  const { ideaId, personas: requestedPersonas, force } = options
  const timestamp = Date.now()
  
  const result: GeneratePostsResult = {
    success: true,
    totalPosts: 0,
    postsByPersona: {} as Record<Persona, Record<Country, number>>,
    errors: [],
  }
  
  try {
    // Get idea with v2 structure
    const idea = await getIdeaWithDetailsV2(ideaId)
    if (!idea) {
      result.success = false
      result.errors.push('Idea not found')
      return result
    }
    
    // Determine which personas to generate for
    const personasToGenerate = requestedPersonas || idea.personas.map((p) => p.persona_type)
    
    for (const personaType of personasToGenerate) {
      const persona = idea.personas.find((p) => p.persona_type === personaType)
      if (!persona) {
        result.errors.push(`Persona "${personaType}" not found`)
        continue
      }
      
      if (!persona.slides || persona.slides.length === 0) {
        result.errors.push(`Persona "${personaType}" has no slides`)
        continue
      }
      
      result.postsByPersona[personaType] = {} as Record<Country, number>
      
      // Generate for each country
      for (const country of COUNTRIES) {
        // If force, delete existing posts for this persona+country
        if (force) {
          await deletePostInstancesForIdea(ideaId, { persona: personaType, country })
        }
        
        // Get existing combo keys and post indexes to avoid duplicates
        const existingKeys = await getExistingComboKeys(ideaId, personaType, country)
        const existingPostIndexes = await getExistingPostIndexes(ideaId, personaType, country)
        
        // Skip if already have enough posts and not forcing
        if (existingPostIndexes.size >= POSTS_PER_COUNTRY && !force) {
          result.postsByPersona[personaType][country] = 0
          continue
        }
        
        // Generate posts (uses available post_index slots 1, 2, 3)
        const posts = await generatePostsForCountry({
          ideaId,
          persona: personaType,
          country,
          slides: persona.slides,
          existingKeys,
          existingPostIndexes,
          timestamp,
        })
        
        result.postsByPersona[personaType][country] = posts.length
        result.totalPosts += posts.length
      }
    }
    
    return result
  } catch (error: any) {
    result.success = false
    result.errors.push(error.message || 'Unknown error')
    return result
  }
}

// ============================================
// Metadata Generation
// ============================================

export interface PostRenderData {
  postInstance: PostInstance
  idea: IdeaWithDetailsV2
  slides: Array<{
    slide_number: number
    slide_type: string
    image_url?: string
    text_content: string
    layout_config: any
  }>
}

export async function getPostRenderData(postId: string): Promise<PostRenderData | null> {
  // This would be called by the export/render process to get all data needed to render a post
  // Implementation depends on how rendering is structured
  return null // TODO: Implement when export is built
}

