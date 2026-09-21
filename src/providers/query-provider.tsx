"use client";

import { useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { makeQueryClient } from "@/lib/query";
import { queryPersister, QUERY_PERSIST_MAX_AGE_MS } from "@/lib/offline/query-persister";

/** Mounts a single QueryClient for the app (created once per browser session), persisted to IndexedDB
 * (§offline, factures/paiements/reçus/transactions/classes/élèves) so the cache survives a page reload
 * or a lost connection instead of restarting empty (see query-persister.ts). */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister: queryPersister, maxAge: QUERY_PERSIST_MAX_AGE_MS }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
