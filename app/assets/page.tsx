import Link from 'next/link'
import { getRenderJobs, getIdeas } from '@/lib/db'
import { PERSONA_LABELS, COUNTRY_LABELS } from '@/lib/constants'
import type { Persona, Country } from '@/types'
import { AssetGrid } from '@/components/asset-grid'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: {
    idea?: string
    persona?: string
    country?: string
  }
}) {
  // Get completed jobs
  const allJobs = await getRenderJobs({ status: 'complete' })
  const ideas = await getIdeas()
  const ideaLookup = new Map(ideas.map((idea) => [idea.id, idea]))

  // Apply filters
  let filteredJobs = allJobs
  
  if (searchParams?.idea) {
    filteredJobs = filteredJobs.filter((job) => job.idea_id === searchParams.idea)
  }
  if (searchParams?.persona) {
    filteredJobs = filteredJobs.filter((job) => job.persona_type === searchParams.persona)
  }
  if (searchParams?.country) {
    filteredJobs = filteredJobs.filter((job) => job.country === searchParams.country)
  }

  // Prepare assets data
  const assets = filteredJobs.map((job) => {
    const idea = ideaLookup.get(job.idea_id)
    return {
      id: job.id,
      ideaId: job.idea_id,
      ideaTitle: idea?.title || 'Unknown',
      persona: job.persona_type as Persona,
      country: job.country as Country,
      outputUrl: job.output_url || '',
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    }
  })

  // Get unique values for filters
  const uniqueIdeas = [...new Set(allJobs.map((j) => j.idea_id))]
    .map((id) => ({ id, title: ideaLookup.get(id)?.title || 'Unknown' }))
  const uniquePersonas = [...new Set(allJobs.map((j) => j.persona_type))] as Persona[]
  const uniqueCountries = [...new Set(allJobs.map((j) => j.country))] as Country[]

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <span className="text-sm text-muted-foreground">
            {assets.length} completed render{assets.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-col gap-4 rounded-lg border border-border p-4 md:flex-row md:items-end md:flex-wrap">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Idea</span>
          <select
            name="idea"
            defaultValue={searchParams?.idea || ''}
            className="rounded border border-border bg-background p-2 min-w-[150px]"
          >
            <option value="">All Ideas</option>
            {uniqueIdeas.map((idea) => (
              <option key={idea.id} value={idea.id}>
                {idea.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Persona</span>
          <select
            name="persona"
            defaultValue={searchParams?.persona || ''}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">All Personas</option>
            {uniquePersonas.map((persona) => (
              <option key={persona} value={persona}>
                {PERSONA_LABELS[persona]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Country</span>
          <select
            name="country"
            defaultValue={searchParams?.country || ''}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">All Countries</option>
            {uniqueCountries.map((country) => (
              <option key={country} value={country}>
                {COUNTRY_LABELS[country]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="default">
            Apply
          </Button>
          <Link
            href="/assets"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Asset Grid */}
      {assets.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="text-muted-foreground space-y-2">
            <p className="text-lg font-medium">No assets yet</p>
            <p className="text-sm">
              Generate render jobs from your ideas to see completed assets here.
            </p>
            <Link href="/ideas">
              <Button variant="outline" className="mt-4">
                Go to Ideas
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <AssetGrid assets={assets} />
      )}
    </div>
  )
}
