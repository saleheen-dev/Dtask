import { type ColumnDef } from "@tanstack/react-table";

import type { ProcessInfo } from "../../common/types";
import { DataTableColumnHeader, DataTableStaticHeader } from "./data-table-column-header";
import {
  ProcessActionsCell,
  ProcessCmdlineCell,
  ProcessNameCell,
  ProcessPidCell,
  ProcessPortsCell,
  ProcessProtocolCell,
  processTableColumnClassNames,
} from "./process-table-cells";
import { Checkbox } from "./ui/checkbox";

export interface ProcessTableColumnOptions {
  allSelected: boolean;
  onToggleSelectAll: () => void;
  selectedPids: Set<number>;
  onToggleSelect: (pid: number) => void;
  conflictingPorts: Set<number>;
  suspendedPids: ReadonlySet<number>;
  showCmdline: boolean;
  onKill: (process: ProcessInfo) => void;
  onSuspend: (process: ProcessInfo) => void;
  onResume: (process: ProcessInfo) => void;
}

export function createProcessTableColumns({
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
}: ProcessTableColumnOptions): ColumnDef<ProcessInfo>[] {
  const columns: ColumnDef<ProcessInfo>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedPids.has(row.original.pid)}
          onCheckedChange={() => onToggleSelect(row.original.pid)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: processTableColumnClassNames.select },
    },
    {
      accessorKey: "pid",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="PID" />
      ),
      cell: ({ row }) => <ProcessPidCell pid={row.getValue("pid")} />,
      meta: { headerClassName: processTableColumnClassNames.pid },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <ProcessNameCell
          proc={row.original}
          conflictingPorts={conflictingPorts}
          suspendedPids={suspendedPids}
        />
      ),
    },
    {
      accessorKey: "ports",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Port(s)" />
      ),
      cell: ({ row }) => (
        <ProcessPortsCell ports={row.getValue("ports") as number[]} />
      ),
      sortingFn: (a, b) => {
        const aMax =
          a.original.ports.length > 0 ? Math.max(...a.original.ports) : -1;
        const bMax =
          b.original.ports.length > 0 ? Math.max(...b.original.ports) : -1;
        return aMax - bMax;
      },
    },
    {
      accessorKey: "protocol",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Protocol" />
      ),
      cell: ({ row }) => (
        <ProcessProtocolCell protocol={row.getValue("protocol")} />
      ),
      meta: { headerClassName: processTableColumnClassNames.protocol },
    },
  ];

  if (showCmdline) {
    columns.push({
      accessorKey: "cmdline",
      header: () => <DataTableStaticHeader title="Command Line" />,
      cell: ({ row }) => (
        <ProcessCmdlineCell cmdline={row.getValue("cmdline")} />
      ),
      enableSorting: false,
    });
  }

  columns.push({
    id: "actions",
    header: () => <DataTableStaticHeader title="Actions" className="text-right" />,
    cell: ({ row }) => (
      <ProcessActionsCell
        proc={row.original}
        suspendedPids={suspendedPids}
        onKill={onKill}
        onSuspend={onSuspend}
        onResume={onResume}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  });

  return columns;
}

export { isSystemProcess } from "./process-table-cells";
