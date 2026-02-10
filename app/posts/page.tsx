import Link from 'next/link'
import { getPostInstances, getIdeas } from '@/lib/db'
import { PERSONA_LABELS, COUNTRY_LABELS } from '@/lib/constants'
import type { PostStatus, Persona, Country } from '@/types'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_COLORS: Record<PostStatus, string> = {
  queued: 'bg-yellow-100 text-yellow-800',
  generating: 'bg-blue-100 text-blue-800',
  encoding: 'bg-purple-100 text-purple-800',
  complete: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<PostStatus, string> = {
  queued: 'Queued',
  generating: 'Generating',
  encoding: 'Encoding',
  complete: 'Complete',
  failed: 'Failed',
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams?: { 
    status?: string
    idea?: string
    persona?: string
    country?: string
  }
}) {
  const statusFilter = searchParams?.status as PostStatus | undefined
  const ideaFilter = searchParams?.idea
  const personaFilter = searchParams?.persona as Persona | undefined
  const countryFilter = searchParams?.country as Country | undefined

  let posts = await getPostInstances({
    status: statusFilter,
    ideaId: ideaFilter,
    persona: personaFilter,
    country: countryFilter,
  })

  const ideas = await getIdeas()
  const ideaLookup = new Map(ideas.map((idea) => [idea.id, idea]))

  // Group posts by idea > persona > country
  const groupedPosts = posts.reduce((acc, post) => {
    const key = `${post.idea_id}-${post.persona_type}-${post.country}`
    if (!acc[key]) {
      acc[key] = {
        ideaId: post.idea_id,
        ideaTitle: ideaLookup.get(post.idea_id)?.title || 'Unknown',
        persona: post.persona_type,
        country: post.country,
        posts: [],
      }
    }
    acc[key].posts.push(post)
    return acc
  }, {} as Record<string, {
    ideaId: string
    ideaTitle: string
    persona: Persona
    country: Country
    posts: typeof posts
  }>)

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Post Instances</h1>
          <span className="text-sm text-muted-foreground">
            {posts.length} post{posts.length === 1 ? '' : 's'} tracked
          </span>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-col gap-4 rounded-lg border border-border p-4 md:flex-row md:items-end md:flex-wrap">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue={statusFilter || ''}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Idea</span>
          <select
            name="idea"
            defaultValue={ideaFilter || ''}
            className="rounded border border-border bg-background p-2 min-w-[150px]"
          >
            <option value="">All Ideas</option>
            {ideas.map((idea) => (
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
            defaultValue={personaFilter || ''}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">All</option>
            {(['main', 'male', 'female'] as Persona[]).map((p) => (
              <option key={p} value={p}>
                {PERSONA_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Country</span>
          <select
            name="country"
            defaultValue={countryFilter || ''}
            className="rounded border border-border bg-background p-2"
          >
            <option value="">All</option>
            {(['uk', 'us', 'ksa', 'my'] as Country[]).map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="default">
            Apply
          </Button>
          <Link
            href="/posts"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Clear
          </Link>
        </div>
      </form>

      {/* Posts Grid */}
      {Object.keys(groupedPosts).length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <div className="text-muted-foreground space-y-2">
            <p className="text-lg font-medium">No posts generated yet</p>
            <p className="text-sm">
              Go to an idea and click "Generate 28 Posts" to create post instances.
            </p>
            <Link href="/ideas">
              <Button variant="outline" className="mt-4">
                Go to Ideas
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedPosts).map((group) => (
            <div
              key={`${group.ideaId}-${group.persona}-${group.country}`}
              className="border border-border rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Link
                    href={`/ideas/${group.ideaId}`}
                    className="font-semibold hover:text-primary"
                  >
                    {group.ideaTitle}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {PERSONA_LABELS[group.persona]} • {COUNTRY_LABELS[group.country]}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {group.posts.length} / 7 posts
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, i) => i + 1).map((postIndex) => {
                  const post = group.posts.find((p) => p.post_index === postIndex)
                  return (
                    <div
                      key={postIndex}
                      className={`aspect-square rounded-lg border flex items-center justify-center text-sm font-medium ${
                        post
                          ? `${STATUS_COLORS[post.status]} border-transparent`
                          : 'border-dashed border-border text-muted-foreground'
                      }`}
                    >
                      {post ? (
                        <span title={STATUS_LABELS[post.status]}>
                          {postIndex}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

