import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { IdeaFormV2 } from '@/components/idea-form-v2'

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

      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold mb-6">New Idea</h1>

        <IdeaFormV2 mode="create" />
      </div>
    </div>
  )
}
