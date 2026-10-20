import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Table, TableHeader, TableBody } from "./ui/table";

interface TableShellProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TableShell({ header, children, className }: TableShellProps) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-card/50", className)}>
      <Table>
        <TableHeader>{header}</TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}
