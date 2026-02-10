import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { IdeaFormV2 } from '@/components/idea-form-v2'
import { getIdeaWithDetailsV2 } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function EditIdeaPage({ params }: { params: { id: string } }) {
  let idea
  try {
    idea = await getIdeaWithDetailsV2(params.id)
  } catch (error) {
    console.error('Failed to load idea for editing', error)
    idea = null
  }

  if (!idea) {
    notFound()
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={`/ideas/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Idea
          </Button>
        </Link>
      </div>

      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold mb-6">Edit Idea</h1>
        <IdeaFormV2 mode="edit" ideaId={params.id} initialIdea={idea} />
      </div>
    </div>
  )
}
