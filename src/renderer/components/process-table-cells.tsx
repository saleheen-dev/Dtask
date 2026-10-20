import { Pause, Play, ScrollText, Trash2 } from "lucide-react";

import type { ProcessInfo } from "../../common/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";

export function isSystemProcess(process: ProcessInfo): boolean {
  if (process.pid < 1000) return true;
  const lower = process.name.toLowerCase();
  return lower.includes("system") || lower.includes("kernel");
}

export function ProcessPidCell({ pid }: { pid: number }) {
  return (
    <span className="font-mono text-muted-foreground">{pid}</span>
  );
}

export function ProcessNameCell({
  proc,
  conflictingPorts,
  suspendedPids,
  icon,
  indent = false,
}: {
  proc: ProcessInfo;
  conflictingPorts: Set<number>;
  suspendedPids: ReadonlySet<number>;
  icon?: string;
  indent?: boolean;
}) {
  const conflict = proc.ports.some((p) => conflictingPorts.has(p));
  const suspended = suspendedPids.has(proc.pid);
  const sys = isSystemProcess(proc);

  return (
    <span className={`flex items-center gap-2${indent ? " pl-8" : ""}`}>
      {conflict && (
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
      )}
      {suspended && (
        <span className="h-1.5 w-1.5 rounded-full bg-suspended" />
      )}
      {icon ? (
        <img
          src={icon}
          alt=""
          aria-hidden="true"
          className="h-5 w-5 shrink-0 rounded-[5px] object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-muted text-[10px] font-semibold uppercase text-muted-foreground"
        >
          {(proc.name || "?").trim().charAt(0) || "?"}
        </span>
      )}
      <span className="max-w-[180px] truncate" title={proc.name}>
        {proc.name}
      </span>
      {suspended && (
        <Badge
          variant="outline"
          className="border-suspended/40 text-suspended"
        >
          Suspended
        </Badge>
      )}
      {sys && (
        <Badge
          variant="outline"
          className="border-warning/40 text-warning"
        >
          System
        </Badge>
      )}
    </span>
  );
}

const MAX_VISIBLE_PORTS = 3;

export function ProcessPortsCell({ ports }: { ports: number[] }) {
  if (ports.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const visible = ports.slice(0, MAX_VISIBLE_PORTS);
  const hidden = ports.length - visible.length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex flex-wrap items-center gap-1">
          {visible.map((port) => (
            <span
              key={port}
              className="rounded border border-border/70 bg-muted/40 px-1 py-px font-mono text-[11px] leading-4"
            >
              {port}
            </span>
          ))}
          {hidden > 0 && (
            <span
              className="rounded border border-warning/40 bg-warning/10 px-1 py-px font-mono text-[11px] leading-4 text-warning"
              title={`${hidden} more ports`}
            >
              +{hidden}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" align="start" className="max-w-md">
        <span className="block max-h-64 overflow-y-auto break-words font-mono text-[11px]">
          {ports.join(", ")}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function ProcessProtocolCell({ protocol }: { protocol: string }) {
  return <span className="text-muted-foreground">{protocol}</span>;
}

export function ProcessCmdlineCell({ cmdline }: { cmdline?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block max-w-[300px] truncate text-muted-foreground cursor-default">
          {cmdline || "—"}
        </span>
      </TooltipTrigger>
      {cmdline && (
        <TooltipContent side="bottom" align="start" className="max-w-[500px] break-all">
          {cmdline}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function ProcessActionsCell({
  proc,
  suspendedPids,
  onKill,
  onSuspend,
  onResume,
  onViewLogs,
}: {
  proc: ProcessInfo;
  suspendedPids: ReadonlySet<number>;
  onKill: (process: ProcessInfo) => void;
  onSuspend: (process: ProcessInfo) => void;
  onResume: (process: ProcessInfo) => void;
  onViewLogs: (process: ProcessInfo) => void;
}) {
  const sys = isSystemProcess(proc);
  const suspended = suspendedPids.has(proc.pid);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onViewLogs(proc)}
        aria-label={`View logs for ${proc.name} (PID ${proc.pid})`}
        title="View logs for this process"
      >
        <ScrollText className="h-3 w-3" />
      </Button>
      {!sys && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => (suspended ? onResume(proc) : onSuspend(proc))}
          aria-label={
            suspended
              ? `Resume process ${proc.name} (PID ${proc.pid})`
              : `Suspend process ${proc.name} (PID ${proc.pid})`
          }
          className="border-suspended/30 hover:border-suspended/60 hover:bg-suspended/10"
        >
          {suspended ? (
            <Play className="h-3 w-3" />
          ) : (
            <Pause className="h-3 w-3" />
          )}
        </Button>
      )}
      <Button
        variant="destructive"
        size="sm"
        onClick={() => onKill(proc)}
        aria-label={`Kill process ${proc.name} (PID ${proc.pid})`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export const processTableColumnClassNames = {
  select: "w-[50px]",
  pid: "w-36",
  protocol: "w-32",
  ports: "w-[210px]",
} as const;
