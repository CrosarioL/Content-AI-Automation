// Disable caching - force fresh data on every request
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AssetsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Assets</h1>
      <div className="border border-border rounded-lg p-8 text-center text-muted-foreground">
        <p>No assets uploaded yet.</p>
      </div>
    </div>
  )
}

