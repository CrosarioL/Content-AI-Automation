import { Persona, Country } from '@/types'

export const PERSONAS: Persona[] = ['main', 'male', 'female']
export const COUNTRIES: Country[] = ['uk', 'us', 'ksa', 'my']

export const PERSONA_LABELS: Record<Persona, string> = {
  main: 'Main',
  male: 'Male',
  female: 'Female',
}

export const COUNTRY_LABELS: Record<Country, string> = {
  uk: 'UK',
  us: 'US',
  ksa: 'KSA',
  my: 'Malaysia',
}

export const JOB_STATUS_LABELS = {
  queued: 'Queued',
  generating: 'Generating',
  encoding: 'Encoding',
  uploading: 'Uploading',
  complete: 'Complete',
  failed: 'Failed',
} as const

export const JOB_PRIORITY_LABELS = {
  high: 'High',
  normal: 'Normal',
  low: 'Low',
} as const

export const JOB_STATUS_COLORS: Record<keyof typeof JOB_STATUS_LABELS, string> = {
  queued: 'bg-gray-100 text-gray-800',
  generating: 'bg-blue-100 text-blue-800',
  encoding: 'bg-indigo-100 text-indigo-800',
  uploading: 'bg-cyan-100 text-cyan-800',
  complete: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
}

