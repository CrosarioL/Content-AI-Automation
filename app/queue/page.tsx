import Link from 'next/link'
import { getRenderJobs, getIdeas } from '@/lib/db'
import {
  JOB_PRIORITY_LABELS,
  JOB_STATUS_COLORS,
  JOB_STATUS_LABELS,
  PERSONA_LABELS,
  COUNTRY_LABELS,
} from '@/lib/constants'
import type { JobPriority, JobStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { QueueRefreshControls } from '@/components/queue-refresh-controls'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_OPTIONS: Array<{ value: 'all' | JobStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: JOB_STATUS_LABELS.queued },
  { value: 'generating', label: JOB_STATUS_LABELS.generating },
  { value: 'encoding', label: JOB_STATUS_LABELS.encoding },
  { value: 'uploading', label: JOB_STATUS_LABELS.uploading },
  { value: 'complete', label: JOB_STATUS_LABELS.complete },
  { value: 'failed', label: JOB_STATUS_LABELS.failed },
]

const PRIORITY_OPTIONS: Array<{ value: 'all' | JobPriority; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'high', label: JOB_PRIORITY_LABELS.high },
  { value: 'normal', label: JOB_PRIORITY_LABELS.normal },
  { value: 'low', label: JOB_PRIORITY_LABELS.low },
]

export default async function QueuePage({
  searchParams,
}: {
  searchParams?: { status?: string; priority?: string }
}) {
  const statusFilter = (searchParams?.status as JobStatus | 'all') || 'all'
  const priorityFilter = (searchParams?.priority as JobPriority | 'all') || 'all'

  const jobs = await getRenderJobs({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
  })

  const ideas = await getIdeas()
  const ideaLookup = new Map(ideas.map((idea) => [idea.id, idea]))

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Render Queue</h1>
          <span className="text-sm text-muted-foreground">
            {jobs.length} job{jobs.length === 1 ? '' : 's'} tracked
          </span>
        </div>
        <QueueRefreshControls />
      </div>

      <form className="flex flex-col gap-4 rounded-lg border border-border p-4 md:flex-row md:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded border border-border bg-background p-2"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Priority</span>
          <select
            name="priority"
            defaultValue={priorityFilter}
            className="rounded border border-border bg-background p-2"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="default">
            Apply
          </Button>
          <Link
            href="/queue"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Clear
          </Link>
        </div>
      </form>

      {jobs.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
          <p>No render jobs found for the selected filters.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Idea</th>
                <th className="px-4 py-3 text-left">Persona</th>
                <th className="px-4 py-3 text-left">Country</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {jobs.map((job) => {
                const idea = ideaLookup.get(job.idea_id)
                const statusBadge = JOB_STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-800'
                return (
                  <tr key={job.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">
                      {idea ? (
                        <Link href={`/ideas/${idea.id}`} className="text-primary underline-offset-2 hover:underline">
                          {idea.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unknown idea</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{PERSONA_LABELS[job.persona_type]}</td>
                    <td className="px-4 py-3">{COUNTRY_LABELS[job.country]}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge}`}>
                        {JOB_STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{JOB_PRIORITY_LABELS[job.priority]}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {job.output_url ? (
                        <a
                          href={job.output_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

