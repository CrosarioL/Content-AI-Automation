import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { getIdeas } from '@/lib/db'
import { DeleteIdeaButton } from '@/components/delete-idea-button'

// Disable caching - force fresh data on every request
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function IdeasPage() {
  let ideas: Awaited<ReturnType<typeof getIdeas>> = []
  let error: string | null = null

  console.log('[IdeasPage] Server component rendering...')
  
  try {
    console.log('[IdeasPage] Calling getIdeas()...')
    ideas = await getIdeas()
    console.log('[IdeasPage] Ideas received:', ideas.length)
    console.log('[IdeasPage] Ideas data:', ideas.map(i => ({ id: i.id, title: i.title })))
  } catch (err: any) {
    error = err.message
    console.error('[IdeasPage] Error fetching ideas:', err)
    console.error('[IdeasPage] Error stack:', err.stack)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Ideas</h1>
        <Link href="/ideas/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Idea
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-md text-destructive">
          Error loading ideas: {error}
        </div>
      )}

      {ideas.length === 0 && !error ? (
        <div className="border border-border rounded-lg p-8 text-center text-muted-foreground">
          <p>No ideas yet. Create your first idea to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="border border-border rounded-lg p-6 hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <Link href={`/ideas/${idea.id}`} className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">{idea.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="px-2 py-1 bg-primary/10 rounded text-primary">
                      {idea.category}
                    </span>
                    <span>
                      {new Date(idea.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {idea.description && (
                    <p className="mt-2 text-muted-foreground line-clamp-2">
                      {idea.description}
                    </p>
                  )}
                </Link>
                <div className="flex-shrink-0">
                  <DeleteIdeaButton ideaId={idea.id} ideaTitle={idea.title} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
