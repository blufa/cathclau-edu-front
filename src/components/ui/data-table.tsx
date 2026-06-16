"use client";

import { Table } from "@mantine/core";
import type { Page } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { Pagination } from "./pagination";

export interface Column<T> {
  /** Stable column id (also used as the sort field unless `sortField` is set). */
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  /** Backend sort field if different from `key`. */
  sortField?: string;
}

export interface SortState {
  field: string;
  dir: "asc" | "desc";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  /** Paginated payload from the backend ({ content, page, … }). */
  page?: Page<T> | null;
  /** Non-paginated rows (for List endpoints). Ignored when `page` is set. */
  rows?: T[];
  loading?: boolean;
  error?: boolean;
  emptyLabel?: string;
  getRowKey: (row: T) => React.Key;
  onPageChange?: (page: number) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable<T>({
  columns,
  page,
  rows,
  loading,
  error,
  emptyLabel = "Aucun résultat.",
  getRowKey,
  onPageChange,
  sort,
  onSortChange,
}: DataTableProps<T>) {
  const data = page ? page.content : (rows ?? []);

  function toggleSort(col: Column<T>) {
    if (!col.sortable || !onSortChange) return;
    const field = col.sortField ?? col.key;
    const dir = sort?.field === field && sort.dir === "asc" ? "desc" : "asc";
    onSortChange({ field, dir });
  }

  if (error) {
    return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les données.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead className="bg-gray-50">
            <Table.Tr>
              {columns.map((col) => {
                const field = col.sortField ?? col.key;
                const active = sort?.field === field;
                return (
                  <Table.Th
                    key={col.key}
                    onClick={() => toggleSort(col)}
                    className={cn(
                      "text-xs font-medium uppercase tracking-wide text-gray-500",
                      alignClass[col.align ?? "left"],
                      col.sortable && "cursor-pointer select-none",
                    )}
                  >
                    {col.header}
                    {col.sortable && active && (sort?.dir === "asc" ? " ▲" : " ▼")}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading && data.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={columns.length}>
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                </Table.Td>
              </Table.Tr>
            )}
            {!loading && data.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={columns.length} className="py-10 text-center text-gray-400">
                  {emptyLabel}
                </Table.Td>
              </Table.Tr>
            )}
            {data.map((row) => (
              <Table.Tr key={getRowKey(row)}>
                {columns.map((col) => (
                  <Table.Td key={col.key} className={cn("text-gray-700", alignClass[col.align ?? "left"])}>
                    {col.render(row)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>

      {page && onPageChange && (
        <Pagination
          page={page.page}
          totalPages={page.totalPages}
          totalElements={page.totalElements}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
