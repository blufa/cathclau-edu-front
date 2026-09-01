"use client";

import { useCallback, useEffect, useState } from "react";
import { isNetworkError } from "@/lib/api/errors";
import { offlineDb } from "./db";

interface CachedQueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /** True tant que les données affichées viennent du cache local plutôt que du dernier appel réseau
   * réussi — sert à afficher un indicateur discret « données en cache » plutôt qu'une erreur bloquante. */
  fromCache: boolean;
}

export interface UseCachedQueryResult<T> extends CachedQueryState<T> {
  refetch: () => void;
}

/**
 * Variante de `useQuery` (hooks/use-query.ts) pour les écrans de CONSULTATION qui doivent rester
 * utilisables hors-ligne (emploi du temps enseignant/élève, référentiels année/classe — §Phase 2
 * hors-ligne). Affiche immédiatement la dernière réponse connue (IndexedDB, `lib/offline/db.ts`)
 * pendant qu'un rafraîchissement réseau tourne en tâche de fond ; si ce rafraîchissement échoue pour
 * une raison réseau ALORS QU'un cache existait déjà, le cache reste affiché sans passer en erreur —
 * sans cache, le comportement est identique à `useQuery` (état d'erreur classique).
 *
 * Ne remplace PAS `useQuery` sur les écrans d'écriture/édition : ne sert que la lecture seule.
 */
export function useCachedQuery<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  deps: unknown[],
): UseCachedQueryResult<T> {
  const [state, setState] = useState<CachedQueryState<T>>({
    data: null,
    loading: true,
    error: null,
    fromCache: false,
  });
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!cacheKey) {
        if (active) setState({ data: null, loading: false, error: null, fromCache: false });
        return;
      }
      const cached = await offlineDb.readCache.get(cacheKey);
      if (!active) return;
      if (cached) {
        setState({ data: cached.payload as T, loading: false, error: null, fromCache: true });
      } else {
        setState((s) => ({ ...s, loading: true, error: null }));
      }

      try {
        const data = await fetcher();
        if (!active) return;
        await offlineDb.readCache.put({ key: cacheKey, payload: data, updatedAt: new Date().toISOString() });
        setState({ data, loading: false, error: null, fromCache: false });
      } catch (error: unknown) {
        if (!active) return;
        if (cached && isNetworkError(error)) {
          return; // hors-ligne mais un cache existait déjà : on le garde affiché, pas d'erreur.
        }
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error : new Error("Erreur inconnue"),
          fromCache: false,
        });
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ...deps, tick]);

  return { ...state, refetch };
}
