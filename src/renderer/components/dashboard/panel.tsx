import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";

interface PanelProps {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Dashboard section card: small title bar + scrollable body. */
export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card/70",
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        {Icon && (
          <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        )}
        <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h2>
        {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
      </header>
      <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
