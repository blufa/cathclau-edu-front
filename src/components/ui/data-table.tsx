"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Checkbox, Menu } from "@mantine/core";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Download, Inbox, Search } from "lucide-react";
import type { Page } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "./skeleton";
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
  /** Value used for client-side search, sorting and CSV export. */
  accessor?: (row: T) => string | number;
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
  // ── Optional TanStack-powered features (off by default) ──
  /** Instant client-side search across columns that define an `accessor`. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Column visibility menu. */
  columnToggle?: boolean;
  /** CSV export of the filtered rows (columns with an `accessor`). */
  exportable?: boolean;
  exportFilename?: string;
  /** Row selection with checkboxes; reports the selected rows. */
  selectable?: boolean;
  onSelectionChange?: (rows: T[]) => void;
  /** Extra toolbar content (e.g. bulk actions) rendered on the right. */
  toolbar?: React.ReactNode;
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
  searchable,
  searchPlaceholder = "Rechercher…",
  columnToggle,
  exportable,
  exportFilename = "export.csv",
  selectable,
  onSelectionChange,
  toolbar,
}: DataTableProps<T>) {
  const data = useMemo(() => (page ? page.content : (rows ?? [])), [page, rows]);
  const serverPaginated = !!page;
  const serverSorted = !!onSortChange;

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columnDefs = useMemo<ColumnDef<T>[]>(() => {
    const defs: ColumnDef<T>[] = columns.map((col) => ({
      id: col.key,
      header: () => col.header,
      accessorFn: col.accessor ? (row) => col.accessor!(row) : () => "",
      cell: ({ row }) => col.render(row.original),
      enableSorting: !!col.sortable,
      meta: { align: col.align ?? "left" },
    }));
    if (selectable) {
      defs.unshift({
        id: "__select",
        header: ({ table }) => (
          <Checkbox
            size="xs"
            color="brand"
            aria-label="Tout sélectionner"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="xs"
            color="brand"
            aria-label="Sélectionner la ligne"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
        meta: { align: "left" },
      });
    }
    return defs;
  }, [columns, selectable]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages its own memoization
  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { globalFilter, sorting, columnVisibility, rowSelection },
    getRowId: (row) => String(getRowKey(row)),
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (onSelectionChange) {
          const selectedIds = new Set(Object.keys(next).filter((k) => next[k]));
          onSelectionChange(data.filter((r) => selectedIds.has(String(getRowKey(r)))));
        }
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: serverSorted ? undefined : getSortedRowModel(),
    getPaginationRowModel: serverPaginated ? undefined : getPaginationRowModel(),
    manualPagination: serverPaginated,
    manualSorting: serverSorted,
    // Pagination client à 10 lignes/page (rows non paginé) avec contrôles rendus plus bas.
    initialState: serverPaginated ? undefined : { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  function handleHeaderSort(col: Column<T>) {
    if (!col.sortable) return;
    if (serverSorted) {
      const field = col.sortField ?? col.key;
      const dir = sort?.field === field && sort.dir === "asc" ? "desc" : "asc";
      onSortChange!({ field, dir });
    } else {
      table.getColumn(col.key)?.toggleSorting();
    }
  }

  function exportCsv() {
    const cols = columns.filter((c) => c.accessor && table.getColumn(c.key)?.getIsVisible());
    const headers = cols.map((c) => (typeof c.header === "string" ? c.header : c.key));
    const lines = table.getFilteredRowModel().rows.map((r) =>
      cols.map((c) => csvCell(c.accessor!(r.original))).join(","),
    );
    const csv = [headers.map(csvCell).join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les données.</p>;
  }

  const hasToolbar = searchable || columnToggle || exportable || toolbar;
  const colSpan = columnDefs.length;

  return (
    <div className="space-y-3">
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            {columnToggle && (
              <Menu position="bottom-end" closeOnItemClick={false} shadow="md" radius="md">
                <Menu.Target>
                  <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
                    <Columns3 className="h-4 w-4" /> Colonnes
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  {table.getAllLeafColumns().filter((c) => c.id !== "__select").map((c) => {
                    const def = columns.find((col) => col.key === c.id);
                    return (
                      <Menu.Item key={c.id} onClick={() => c.toggleVisibility()}>
                        <Checkbox
                          size="xs"
                          color="brand"
                          readOnly
                          checked={c.getIsVisible()}
                          label={typeof def?.header === "string" ? def.header : c.id}
                        />
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>
            )}
            {exportable && (
              <button
                onClick={exportCsv}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            )}
          </div>
        </div>
      )}

      {selectable && table.getSelectedRowModel().rows.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800">
          {table.getSelectedRowModel().rows.length} ligne(s) sélectionnée(s)
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.02]">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const def = columns.find((c) => c.key === header.column.id);
                  const align = (header.column.columnDef.meta as { align?: keyof typeof alignClass })?.align ?? "left";
                  const sortable = !!def?.sortable;
                  const field = def?.sortField ?? def?.key;
                  const activeServer = serverSorted && sort?.field === field;
                  const clientDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={() => def && handleHeaderSort(def)}
                      className={cn(
                        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500",
                        alignClass[align],
                        sortable && "cursor-pointer select-none",
                      )}
                    >
                      <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {sortable && (
                          <SortIcon dir={serverSorted ? (activeServer ? sort!.dir : false) : clientDir} />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && data.length === 0 && <TableSkeleton columns={colSpan} />}
            {!loading && table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="py-14 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Inbox className="h-8 w-8" strokeWidth={1.5} />
                    <span className="text-sm">{emptyLabel}</span>
                  </div>
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 transition-colors hover:bg-brand-50/40">
                {row.getVisibleCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as { align?: keyof typeof alignClass })?.align ?? "left";
                  return (
                    <td key={cell.id} className={cn("px-4 py-3 text-slate-700", alignClass[align])}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {serverPaginated && onPageChange && (
        <Pagination
          page={page!.page}
          totalPages={page!.totalPages}
          totalElements={page!.totalElements}
          onPageChange={onPageChange}
        />
      )}
      {!serverPaginated && table.getPageCount() > 1 && (
        <Pagination
          page={table.getState().pagination.pageIndex}
          totalPages={table.getPageCount()}
          totalElements={table.getFilteredRowModel().rows.length}
          onPageChange={(p) => table.setPageIndex(p)}
        />
      )}
    </div>
  );
}

function SortIcon({ dir }: { dir: "asc" | "desc" | false }) {
  if (dir === "asc") return <ArrowUp className="h-3.5 w-3.5 text-brand-600" />;
  if (dir === "desc") return <ArrowDown className="h-3.5 w-3.5 text-brand-600" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />;
}

function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
