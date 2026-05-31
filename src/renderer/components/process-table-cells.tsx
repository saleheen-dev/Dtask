import { Pause, Play, Trash2 } from "lucide-react";

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
  indent = false,
}: {
  proc: ProcessInfo;
  conflictingPorts: Set<number>;
  suspendedPids: ReadonlySet<number>;
  indent?: boolean;
}) {
  const conflict = proc.ports.some((p) => conflictingPorts.has(p));
  const suspended = suspendedPids.has(proc.pid);
  const sys = isSystemProcess(proc);

  return (
    <span className={`flex items-center gap-2${indent ? " pl-8" : ""}`}>
      {conflict && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
      {suspended && (
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
      )}
      <span className="max-w-[180px] truncate" title={proc.name}>
        {proc.name}
      </span>
      {suspended && (
        <Badge
          variant="outline"
          className="border-yellow-500/40 text-yellow-400"
        >
          Suspended
        </Badge>
      )}
      {sys && (
        <Badge
          variant="outline"
          className="border-amber-500/40 text-amber-400"
        >
          System
        </Badge>
      )}
    </span>
  );
}

export function ProcessPortsCell({ ports }: { ports: number[] }) {
  return (
    <span className="font-mono text-muted-foreground">
      {ports.length > 0 ? ports.join(", ") : "—"}
    </span>
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
}: {
  proc: ProcessInfo;
  suspendedPids: ReadonlySet<number>;
  onKill: (process: ProcessInfo) => void;
  onSuspend: (process: ProcessInfo) => void;
  onResume: (process: ProcessInfo) => void;
}) {
  const sys = isSystemProcess(proc);
  const suspended = suspendedPids.has(proc.pid);

  return (
    <div className="flex items-center justify-end gap-1">
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
          className="border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/10"
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
} as const;
