import * as React from "react";
import { Table as MantineTable } from "@mantine/core";
import { cn } from "@/lib/utils";

export function Table({ className, children }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
      <MantineTable highlightOnHover verticalSpacing="sm" horizontalSpacing="md" className={className}>
        {children}
      </MantineTable>
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <MantineTable.Thead className={cn("border-b border-slate-200 bg-slate-50/80", className)} {...props} />;
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <MantineTable.Th
      className={cn("whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500", className)}
      {...props}
    />
  );
}

export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <MantineTable.Tbody {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <MantineTable.Tr className={className} {...props} />;
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <MantineTable.Td className={cn("text-slate-700", className)} {...props} />;
}
