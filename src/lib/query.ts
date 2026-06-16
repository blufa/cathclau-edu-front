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
} as const;
