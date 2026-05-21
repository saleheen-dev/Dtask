import { Loader2 } from 'lucide-react'

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
      <p className="mt-4 text-sm font-medium tracking-wide">Scanning processes…</p>
    </div>
  )
}