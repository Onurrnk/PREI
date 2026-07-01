// =====================================================================
// PREI | useFetch
// Standardizes the load/error/data lifecycle every list & detail view
// repeated by hand. Handles abort-on-unmount and manual refetch.
// For heavier needs (caching, mutations, background refresh) this is the
// natural seam to swap in TanStack Query later without touching callers.
// =====================================================================
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * @param fetcher  function performing the request; receives an AbortSignal
 * @param deps     dependency list; refetches when these change
 */
export function useFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    fetcher(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err: unknown) => {
        if (!active || (err as Error).name === 'AbortError') return;
        const message =
          err instanceof ApiError ? err.message : 'Beklenmeyen bir hata oluştu.';
        setError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, refetch };
}
