import { type SortingState } from "@tanstack/react-table";

import { DataTableColumnHeader, DataTableStaticHeader } from "./data-table-column-header";
import { processTableColumnClassNames } from "./process-table-cells";
import { Checkbox } from "./ui/checkbox";
import { TableHead, TableRow } from "./ui/table";

interface ProcessTableHeaderRowProps {
  showCmdline: boolean;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  sorting: SortingState;
  onSortChange: (id: string, desc: boolean) => void;
}

function GroupSortHeader({
  title,
  columnId,
  sorting,
  onSortChange,
}: {
  title: string;
  columnId: string;
  sorting: SortingState;
  onSortChange: (id: string, desc: boolean) => void;
}) {
  const sorted = sorting.find((s) => s.id === columnId);
  const fakeColumn = {
    getCanSort: () => true,
    getIsSorted: () =>
      sorted ? (sorted.desc ? ("desc" as const) : ("asc" as const)) : false,
    toggleSorting: (desc: boolean) => onSortChange(columnId, desc),
  };

  return (
    <DataTableColumnHeader
      column={
        fakeColumn as Parameters<typeof DataTableColumnHeader>[0]["column"]
      }
      title={title}
    />
  );
}

export function ProcessTableHeaderRow({
  showCmdline,
  allSelected,
  onToggleSelectAll,
  sorting,
  onSortChange,
}: ProcessTableHeaderRowProps) {
  return (
    <TableRow>
      <TableHead className={processTableColumnClassNames.select}>
        <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
      </TableHead>
      <TableHead className={processTableColumnClassNames.pid}>
        <GroupSortHeader
          title="PID"
          columnId="pid"
          sorting={sorting}
          onSortChange={onSortChange}
        />
      </TableHead>
      <TableHead>
        <GroupSortHeader
          title="Name"
          columnId="name"
          sorting={sorting}
          onSortChange={onSortChange}
        />
      </TableHead>
      <TableHead>
        <GroupSortHeader
          title="Port(s)"
          columnId="ports"
          sorting={sorting}
          onSortChange={onSortChange}
        />
      </TableHead>
      <TableHead className={processTableColumnClassNames.protocol}>
        <GroupSortHeader
          title="Protocol"
          columnId="protocol"
          sorting={sorting}
          onSortChange={onSortChange}
        />
      </TableHead>
      {showCmdline && (
        <TableHead>
          <DataTableStaticHeader title="Command Line" />
        </TableHead>
      )}
      <TableHead>
        <DataTableStaticHeader title="Actions" className="text-right" />
      </TableHead>
    </TableRow>
  );
}
