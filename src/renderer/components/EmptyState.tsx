import { Inbox } from "lucide-react";

interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'No processes found' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Inbox className="h-9 w-9 opacity-60" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium">{message}</p>
      <p className="mt-1 text-[11px]">
        Try a different search term, or refresh the process list.
      </p>
    </div>
  );
}
