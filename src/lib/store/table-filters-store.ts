import { useCallback } from "react";
import { create } from "zustand";

/** Filtres génériques d'une liste (recherche, statut, page...). Valeurs libres par table. */
export type TableFilterValues = Record<string, string | number | boolean | null>;

interface TableFiltersState {
  /** Filtres persistés entre navigations, indexés par identifiant de table (ex. "students.list"). */
  byTable: Record<string, TableFilterValues>;
  setTableFilters: (tableId: string, values: TableFilterValues) => void;
  resetTableFilters: (tableId: string) => void;
}

const useTableFiltersStore = create<TableFiltersState>((set) => ({
  byTable: {},
  setTableFilters: (tableId, values) =>
    set((s) => ({ byTable: { ...s.byTable, [tableId]: { ...s.byTable[tableId], ...values } } })),
  resetTableFilters: (tableId) =>
    set((s) => {
      const rest = { ...s.byTable };
      delete rest[tableId];
      return { byTable: rest };
    }),
}));

/**
 * Filtres de liste persistés entre navigations (recherche, statut, page...), keyés par tableId.
 * Ex.: const { filters, setFilters } = useTableFilters("students.list", { search: "", status: "" });
 */
export function useTableFilters<T extends TableFilterValues>(tableId: string, defaults: T) {
  const stored = useTableFiltersStore((s) => s.byTable[tableId]) as T | undefined;
  const setTableFilters = useTableFiltersStore((s) => s.setTableFilters);
  const resetTableFiltersAction = useTableFiltersStore((s) => s.resetTableFilters);
  const filters = { ...defaults, ...stored };

  const setFilters = useCallback(
    (values: Partial<T>) => setTableFilters(tableId, values as TableFilterValues),
    [setTableFilters, tableId],
  );
  const resetFilters = useCallback(() => resetTableFiltersAction(tableId), [resetTableFiltersAction, tableId]);

  return { filters, setFilters, resetFilters };
}
