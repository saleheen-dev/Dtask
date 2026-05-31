import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { type SortingState } from "@tanstack/react-table";
import type { ProcessInfo } from "../../common/types";
import { createProcessTableColumns } from "./process-table-columns";
import {
  ProcessActionsCell,
  ProcessCmdlineCell,
  ProcessNameCell,
  ProcessPidCell,
  ProcessPortsCell,
  ProcessProtocolCell,
  processTableColumnClassNames,
} from "./process-table-cells";
import { ProcessTableHeaderRow } from "./process-table-header";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { DataTable } from "./ui/data-table";
import { TableRow, TableCell } from "./ui/table";
import { TableShell } from "./TableShell";

interface ProcessTableProps {
  processes: ProcessInfo[];
  onKill: (process: ProcessInfo) => void;
  onSuspend: (process: ProcessInfo) => void;
  onResume: (process: ProcessInfo) => void;
  selectedPids: Set<number>;
  onToggleSelect: (pid: number) => void;
  onToggleSelectAll: () => void;
  conflictingPorts: Set<number>;
  showCmdline: boolean;
  groupByName: boolean;
  suspendedPids: ReadonlySet<number>;
  highlights: ReadonlyMap<number, "added">;
}

function getProcessRowClassName(
  proc: ProcessInfo,
  conflictingPorts: Set<number>,
  highlights: ReadonlyMap<number, "added">,
): string {
  const conflict = proc.ports.some((p) => conflictingPorts.has(p));
  const added = highlights.get(proc.pid);
  const hlClass =
    added === "added"
      ? "animate-pulse bg-emerald-500/10 border-l-2 border-l-emerald-400"
      : "";
  const conflictClass = conflict ? "bg-amber-500/5" : "";
  return `bg-card/30 hover:bg-muted/40 ${conflictClass} ${hlClass}`.trim();
}

export function ProcessTable({
  processes,
  onKill,
  onSuspend,
  onResume,
  selectedPids,
  onToggleSelect,
  onToggleSelectAll,
  conflictingPorts,
  showCmdline,
  groupByName,
  suspendedPids,
  highlights,
}: ProcessTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "pid", desc: false },
  ]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const allSelected =
    processes.length > 0 && processes.every((p) => selectedPids.has(p.pid));

  const columns = useMemo(
    () =>
      createProcessTableColumns({
        allSelected,
        onToggleSelectAll,
        selectedPids,
        onToggleSelect,
        conflictingPorts,
        suspendedPids,
        showCmdline,
        onKill,
        onSuspend,
        onResume,
      }),
    [
      allSelected,
      onToggleSelectAll,
      selectedPids,
      onToggleSelect,
      conflictingPorts,
      suspendedPids,
      showCmdline,
      onKill,
      onSuspend,
      onResume,
    ],
  );

  const sortedGroups = useMemo(() => {
    if (!groupByName) return null;
    const g = new Map<string, ProcessInfo[]>();
    for (const p of processes) {
      const arr = g.get(p.name) ?? [];
      arr.push(p);
      g.set(p.name, arr);
    }
    const entries = Array.from(g.entries());
    const s = sorting[0];
    if (s) {
      const dir = s.desc ? -1 : 1;
      entries.sort(([aName, aProcs], [bName, bProcs]) => {
        if (s.id === "name") return aName.localeCompare(bName) * dir;
        if (s.id === "pid") {
          const aMin = Math.min(...aProcs.map((p) => p.pid));
          const bMin = Math.min(...bProcs.map((p) => p.pid));
          return (aMin - bMin) * dir;
        }
        if (s.id === "ports") {
          const aMax = Math.max(
            ...aProcs.flatMap((p) => (p.ports.length > 0 ? p.ports : [-1])),
          );
          const bMax = Math.max(
            ...bProcs.flatMap((p) => (p.ports.length > 0 ? p.ports : [-1])),
          );
          return (aMax - bMax) * dir;
        }
        if (s.id === "protocol") {
          return (
            aProcs[0]?.protocol.localeCompare(bProcs[0]?.protocol || "") * dir
          );
        }
        return 0;
      });
    }
    return entries;
  }, [processes, groupByName, sorting]);

  const setGroupSort = useCallback((id: string, desc: boolean) => {
    setSorting([{ id, desc }]);
  }, []);

  const getRowClassName = useCallback(
    (proc: ProcessInfo) =>
      getProcessRowClassName(proc, conflictingPorts, highlights),
    [conflictingPorts, highlights],
  );

  if (groupByName && sortedGroups) {
    return (
      <TableShell
        header={
          <ProcessTableHeaderRow
            showCmdline={showCmdline}
            allSelected={allSelected}
            onToggleSelectAll={onToggleSelectAll}
            sorting={sorting}
            onSortChange={setGroupSort}
          />
        }
      >
        {sortedGroups.map(([name, procs]) => {
          const expanded = expandedGroups.has(name);
          const groupSelected = procs.every((p) => selectedPids.has(p.pid));
          const halfSelected =
            procs.some((p) => selectedPids.has(p.pid)) && !groupSelected;
          const allPorts = Array.from(new Set(procs.flatMap((p) => p.ports)));
          return (
            <Fragment key={`group-${name}`}>
              <TableRow className="bg-card/30 hover:bg-muted/40">
                <TableCell className={processTableColumnClassNames.select}>
                  <Checkbox
                    checked={halfSelected ? "indeterminate" : groupSelected}
                    onCheckedChange={() => {
                      if (groupSelected)
                        procs.forEach((p) => onToggleSelect(p.pid));
                      else
                        procs.forEach((p) => {
                          if (!selectedPids.has(p.pid)) onToggleSelect(p.pid);
                        });
                    }}
                  />
                </TableCell>
                <TableCell className={processTableColumnClassNames.pid}>
                  <div className="flex items-center gap-1">
                    {Array.from(new Set(procs.map((p) => p.pid)))
                      .slice(0, 3)
                      .map((pid) => (
                        <ProcessPidCell key={pid} pid={pid} />
                      ))}
                    {procs.length > 3 && (
                      <span className="text-xs text-muted-foreground">…</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() => toggleGroup(name)}
                      className="flex items-center gap-1 font-normal text-foreground transition-colors hover:text-primary"
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {name}
                    </button>
                    <Badge variant="secondary" className="text-[10px]">
                      ×{procs.length}
                    </Badge>
                  </span>
                </TableCell>
                <TableCell>
                  <ProcessPortsCell ports={allPorts} />
                </TableCell>
                <TableCell className={processTableColumnClassNames.protocol}>
                  <ProcessProtocolCell
                    protocol={procs[0]?.protocol || "TCP"}
                  />
                </TableCell>
                {showCmdline && (
                  <TableCell>
                    <span className="text-muted-foreground italic">Multiple</span>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      procs.forEach((p) => {
                        if (!selectedPids.has(p.pid)) onToggleSelect(p.pid);
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Kill All
                  </Button>
                </TableCell>
              </TableRow>
              {expanded &&
                procs.map((proc, idx) => {
                  const conflict = proc.ports.some((p) => conflictingPorts.has(p));
                  const added = highlights.get(proc.pid);
                  const hlClass =
                    added === "added"
                      ? "animate-pulse bg-emerald-500/10 border-l-2 border-l-emerald-400"
                      : "";
                  const conflictClass = conflict ? "bg-amber-500/5" : "";
                  return (
                  <TableRow
                    key={proc.pid}
                    className={`bg-muted/10 hover:bg-muted/20 ${idx % 2 === 0 ? "bg-muted/5" : ""} ${conflictClass} ${hlClass}`}
                  >
                    <TableCell className={`${processTableColumnClassNames.select} pl-6`}>
                      <Checkbox
                        checked={selectedPids.has(proc.pid)}
                        onCheckedChange={() => onToggleSelect(proc.pid)}
                      />
                    </TableCell>
                    <TableCell className={processTableColumnClassNames.pid}>
                      <ProcessPidCell pid={proc.pid} />
                    </TableCell>
                    <TableCell>
                      <ProcessNameCell
                        proc={proc}
                        conflictingPorts={conflictingPorts}
                        suspendedPids={suspendedPids}
                        indent
                      />
                    </TableCell>
                    <TableCell>
                      <ProcessPortsCell ports={proc.ports} />
                    </TableCell>
                    <TableCell className={processTableColumnClassNames.protocol}>
                      <ProcessProtocolCell protocol={proc.protocol} />
                    </TableCell>
                    {showCmdline && (
                      <TableCell>
                        <ProcessCmdlineCell cmdline={proc.cmdline} />
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <ProcessActionsCell
                        proc={proc}
                        suspendedPids={suspendedPids}
                        onKill={onKill}
                        onSuspend={onSuspend}
                        onResume={onResume}
                      />
                    </TableCell>
                  </TableRow>
                  );
                })}
            </Fragment>
          );
        })}
      </TableShell>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={processes}
      sorting={sorting}
      onSortingChange={setSorting}
      getRowClassName={getRowClassName}
    />
  );
}
