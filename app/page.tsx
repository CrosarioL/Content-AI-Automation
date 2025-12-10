import { redirect } from 'next/navigation'

// Disable caching - force fresh data on every request
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Home() {
  redirect('/ideas')
}

