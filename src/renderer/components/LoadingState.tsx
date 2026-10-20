import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-9 w-9 animate-spin text-success" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium tracking-wide">
        Scanning processes…
      </p>
    </div>
  );
}
