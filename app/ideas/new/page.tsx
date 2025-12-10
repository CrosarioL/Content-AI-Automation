import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { IdeaForm } from '@/components/idea-form'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function NewIdeaPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/ideas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Ideas
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">New Idea</h1>

        <IdeaForm mode="create" />
      </div>
    </div>
  )
}
