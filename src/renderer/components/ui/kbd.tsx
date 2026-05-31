import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-sm border border-border/50 bg-background px-1.5 font-mono text-[11px] font-medium text-muted-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
    </span>
  );
}

export { Kbd, KbdGroup };
