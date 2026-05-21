import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'No processes found' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
      <Inbox className="h-12 w-12" />
      <p className="mt-3 text-sm font-medium">{message}</p>
    </div>
  )
}