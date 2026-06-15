import * as React from "react";
import { Table as MantineTable } from "@mantine/core";
import { cn } from "@/lib/utils";

export function Table({ className, children }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <MantineTable highlightOnHover verticalSpacing="sm" horizontalSpacing="md" className={className}>
        {children}
      </MantineTable>
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <MantineTable.Thead className={cn("bg-gray-50", className)} {...props} />;
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <MantineTable.Th
      className={cn("text-xs font-medium uppercase tracking-wide text-gray-500", className)}
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
  return <MantineTable.Td className={cn("text-gray-700", className)} {...props} />;
}
