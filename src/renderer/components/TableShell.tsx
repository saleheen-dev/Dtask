import type { ReactNode } from "react";
import { Table, TableHeader, TableBody } from "./ui/table";

interface TableShellProps {
  header: ReactNode;
  children: ReactNode;
}

export function TableShell({ header, children }: TableShellProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/50">
      <Table>
        <TableHeader>{header}</TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}
