import { QueryClient } from "@tanstack/react-query";

/** Shared QueryClient factory: sensible defaults for a CRUD admin app. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * Central registry of query keys. New modules add their namespaces here so that
 * mutations can invalidate precisely (e.g. queryClient.invalidateQueries({ queryKey: qk.users.all })).
 */
export const qk = {
  users: {
    all: ["users"] as const,
    list: (params: Record<string, unknown>) => ["users", "list", params] as const,
    detail: (id: number) => ["users", "detail", id] as const,
  },
  roles: {
    all: ["roles"] as const,
    detail: (id: number) => ["roles", "detail", id] as const,
  },
  permissions: {
    all: ["permissions"] as const,
  },
  students: {
    all: ["students"] as const,
    list: (params: Record<string, unknown>) => ["students", "list", params] as const,
    detail: (id: number) => ["students", "detail", id] as const,
  },
  enrollments: {
    all: ["enrollments"] as const,
    list: (params: Record<string, unknown>) => ["enrollments", "list", params] as const,
    movements: (params: Record<string, unknown>) => ["enrollments", "movements", params] as const,
    overview: (params: Record<string, unknown>) => ["enrollments", "overview", params] as const,
  },
  classes: {
    all: ["classes"] as const,
    list: (params: Record<string, unknown>) => ["classes", "list", params] as const,
    detail: (id: number) => ["classes", "detail", id] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: (params: Record<string, unknown>) => ["invoices", "list", params] as const,
    detail: (id: number) => ["invoices", "detail", id] as const,
  },
  fees: {
    all: ["fees"] as const,
    list: (params: Record<string, unknown>) => ["fees", "list", params] as const,
  },
  billingRules: {
    all: ["billingRules"] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (params: Record<string, unknown>) => ["payments", "list", params] as const,
    detail: (id: number) => ["payments", "detail", id] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    list: (params: Record<string, unknown>) => ["transactions", "list", params] as const,
  },
  receipts: {
    all: ["receipts"] as const,
    list: (studentId: number | undefined) => ["receipts", "list", studentId ?? null] as const,
    byReference: (reference: string) => ["receipts", "byReference", reference] as const,
  },
} as const;
