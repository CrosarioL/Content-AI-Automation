'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lightbulb, ListTodo, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Ideas', href: '/ideas', icon: Lightbulb },
  { name: 'Queue', href: '/queue', icon: ListTodo },
  { name: 'Assets', href: '/assets', icon: ImageIcon },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 border-r border-border bg-card">
      <div className="flex h-16 items-center border-b border-border px-6">
        <h1 className="text-lg font-semibold">Content Generator</h1>
      </div>
      <nav className="p-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

