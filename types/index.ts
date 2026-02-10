// Core domain types for the content generation app

export type Persona = 'main' | 'male' | 'female';
export type Country = 'uk' | 'us' | 'ksa' | 'my';

export type AspectRatio = '9:16' | '3:4';

export interface Idea {
  id: string;
  title: string;
  category: string;
  description?: string;
  aspect_ratio?: AspectRatio; // Canvas aspect ratio (idea-wide)
  created_at: string;
  updated_at: string;
}

export interface PersonaVariant {
  id: string;
  idea_id: string;
  persona_type: Persona;
  slide_template_id?: string;
  created_at: string;
}

export interface CountryVariant {
  id: string;
  persona_variant_id: string;
  country: Country;
  day_number?: number;
  status: 'draft' | 'ready';
  created_at: string;
}

export interface SlideTemplate {
  id: string;
  name: string;
  slide_count: number;
  slide_definitions: Array<{
    slide_number: number;
    type: string;
    label: string;
  }>;
  created_at: string;
}

export interface SlideTextLayer {
  id: string;
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  color: string;
  background?: string;
  align: 'left' | 'center' | 'right';
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  scale: { x: number; y: number };
  opacity: number;
  zIndex: number;
  startMs?: number;
  endMs?: number;
  metadata?: Record<string, any>;
  locked?: boolean;
  // TikTok-native text styling
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  letterSpacing?: number;
  lineHeight?: number;
  preset?: 'tiktok-classic' | 'tiktok-yellow' | 'tiktok-red' | 'caption' | 'bold-outline' | 'neon' | 'custom' | 'tiktok-label';
  /** When set, backend uses this for rendering so line breaks match the front end exactly */
  wrappedText?: string;
}

export interface SlideLayoutConfig {
  version: number;
  canvas: { width: number; height: number };
  safeZone: { top: number; bottom: number };
  background?: { color?: string; image?: string };
  layers: SlideTextLayer[];
  metadata?: Record<string, any>;
  lastModifiedAt?: string;
  lastModifiedBy?: string;
}

export interface SlideTextVariant {
  id: string;
  slide_id: string;
  variant_label: string;
  content: string;
  layout_config?: SlideLayoutConfig | null;
  sort_order: number;
  created_at: string;
}

export interface SlideImageVariant {
  id: string;
  slide_id: string;
  variant_label: string;
  storage_path: string;
  caption?: string;
  aspect_ratio?: string;
  metadata?: Record<string, any>;
  sort_order: number;
  created_at: string;
}

export interface SlideContent {
  id: string;
  country_variant_id: string;
  slide_number: number;
  slide_type: string; // 'hook', 'problem', 'solution', etc.
  content: string;
  title?: string;
  notes?: string;
  created_at: string;
  text_variants?: SlideTextVariant[];
  image_variants?: SlideImageVariant[];
}

export type JobStatus = 'queued' | 'generating' | 'encoding' | 'uploading' | 'complete' | 'failed';
export type JobPriority = 'high' | 'normal' | 'low';

export interface RenderJob {
  id: string;
  idea_id: string;
  persona_type: Persona;
  country: Country;
  template_id?: string;
  status: JobStatus;
  priority: JobPriority;
  batch_id?: string;
  tags?: string[];
  output_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface IdeaImage {
  id: string;
  idea_id: string;
  storage_path: string;
  tags: string[];
  created_at: string;
}

// UI-specific types
export interface PersonaVariantWithDetails extends PersonaVariant {
  countries: Array<
    CountryVariant & {
      slides: (SlideContent & {
        text_variants: SlideTextVariant[];
        image_variants: SlideImageVariant[];
      })[];
    }
  >;
}

export interface IdeaWithDetails extends Idea {
  personas: PersonaVariantWithDetails[];
  images?: IdeaImage[];
}

export interface RenderJobWithIdea extends RenderJob {
  idea: Idea;
}

// ============================================
// Mass Poster v2 Types
// ============================================

export type PostStatus = 'queued' | 'generating' | 'encoding' | 'complete' | 'failed';
export type ImageSlot = 'hook' | 'body' | 'background' | 'generic';

// Post instance represents a single generated post (1 of 7 per country per persona)
export interface PostInstance {
  id: string;
  idea_id: string;
  persona_type: Persona;
  country: Country;
  post_index: number; // 1-7
  seed: string;
  combo_key: string;
  choices: PostChoices;
  status: PostStatus;
  output_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// The specific choices made for a post instance
export interface PostChoices {
  slides: Array<{
    slide_number: number;
    image_id?: string; // which image from the pool was chosen
    text_variant_index: number; // 1 or 2
  }>;
}

// Persona slide (not country-specific)
export interface PersonaSlide {
  id: string;
  persona_variant_id: string;
  slide_number: number;
  slide_type: string;
  title?: string;
  notes?: string;
  created_at: string;
}

// Image transform/crop settings
export interface ImageTransform {
  scale?: number; // 1.0 = original size, >1.0 = zoomed in
  x?: number; // Horizontal offset (pan left/right)
  y?: number; // Vertical offset (pan up/down)
  crop?: {
    x: number; // Crop start X (0-1)
    y: number; // Crop start Y (0-1)
    width: number; // Crop width (0-1)
    height: number; // Crop height (0-1)
  };
}

// Image pool entry (multiple images per slide, not country-specific)
export interface SlideImagePool {
  id: string;
  persona_slide_id: string;
  slot: ImageSlot;
  storage_path: string;
  variant_label?: string;
  caption?: string;
  aspect_ratio?: string;
  metadata?: Record<string, any>;
  transform?: ImageTransform; // Crop/zoom/pan settings
  sort_order: number;
  created_at: string;
}

// Text pool entry (2 per country per slide)
export interface SlideTextPool {
  id: string;
  persona_slide_id: string;
  country: Country;
  variant_index: number; // 1 or 2
  content: string;
  layout_config?: SlideLayoutConfig | null;
  created_at: string;
}

// Extended SlideTextLayer with outline/stroke support
export interface SlideTextLayerV2 extends SlideTextLayer {
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  letterSpacing?: number;
  lineHeight?: number;
  preset?: 'tiktok-classic' | 'tiktok-yellow' | 'tiktok-red' | 'caption' | 'bold-outline' | 'neon' | 'custom';
}

// Persona slide with all pools loaded
export interface PersonaSlideWithPools extends PersonaSlide {
  image_pools: SlideImagePool[];
  text_pools: SlideTextPool[];
}

// Persona variant for v2 (slides directly under persona, no country nesting for editing)
export interface PersonaVariantV2 extends PersonaVariant {
  slides: PersonaSlideWithPools[];
}

// Idea with v2 structure
export interface IdeaWithDetailsV2 extends Idea {
  personas: PersonaVariantV2[];
  images?: IdeaImage[];
}

// Post instance with idea details for display
export interface PostInstanceWithIdea extends PostInstance {
  idea: Idea;
}

// Generation request
export interface GeneratePostsRequest {
  ideaId: string;
  personas?: Persona[]; // If not provided, generate for all active personas
  force?: boolean; // Regenerate even if posts exist
}

// Generation result
export interface GeneratePostsResult {
  success: boolean;
  postsCreated: number;
  postsByCountry: Record<Country, number>;
  errors?: string[];
}

// Export request
export interface ExportPostsRequest {
  ideaId: string;
  personas?: Persona[];
  countries?: Country[];
  format: 'zip';
}

// Metadata included in each post folder
export interface PostMetadata {
  idea_id: string;
  idea_title: string;
  persona_type: Persona;
  country: Country;
  post_index: number;
  seed: string;
  combo_key: string;
  choices: PostChoices;
  generated_at: string;
  slides: Array<{
    slide_number: number;
    slide_type: string;
    image_used?: string;
    text_variant_used: number;
    text_content: string;
  }>;
}

