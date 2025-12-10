// Core domain types for the content generation app

export type Persona = 'main' | 'male' | 'female';
export type Country = 'uk' | 'us' | 'ksa' | 'my';

export interface Idea {
  id: string;
  title: string;
  category: string;
  description?: string;
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

