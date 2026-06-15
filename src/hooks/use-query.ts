"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/errors";

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
}

export interface UseQueryResult<T> extends QueryState<T> {
  refetch: () => void;
}

/**
 * Minimal data-fetching hook for GET endpoints: runs `fetcher` whenever `deps` change and
 * exposes loading/error/refetch. Keeps a single dependency array so callers control re-fetching.
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): UseQueryResult<T> {
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await fetcher();
        if (active) setState({ data, loading: false, error: null });
      } catch (error: unknown) {
        if (active) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error : new Error("Erreur inconnue"),
          });
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, refetch };
}
