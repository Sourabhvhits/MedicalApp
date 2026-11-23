'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getList } from '@/lib/api-client';
import type { PaginatedResponse } from '@/lib/types';

export type ListParams = Record<string, string | number | boolean | undefined>;

interface UseListOptions {
  /** Extra filters merged into every request. */
  initialFilters?: ListParams;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Standard list-screen state: debounced search, filters, pagination and the
 * query itself.
 *
 * Changing a filter or the search term resets to page 1 inside the setter
 * rather than in an effect, so there is never a render showing page 5 of a
 * freshly filtered result.
 */
export function useListQuery<T>(
  url: string,
  keyFactory: (params: ListParams) => readonly unknown[],
  options: UseListOptions = {},
) {
  const { initialFilters = {}, pageSize = 20, enabled = true } = options;

  const [page, setPage] = useState(1);
  const [search, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFiltersState] = useState<ListParams>(initialFilters);

  // Only the debounce timer lives in an effect — it synchronises with a timer,
  // which is exactly what effects are for.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value);
    setPage(1);
  }, []);

  const setFilter = useCallback((key: string, value: string | number | boolean | undefined) => {
    setFiltersState((current) => {
      const next = { ...current };
      if (value === undefined || value === '' || value === 'ALL') delete next[key];
      else next[key] = value;
      return next;
    });
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setSearchValue('');
    setDebouncedSearch('');
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = useMemo<ListParams>(
    () => ({
      page,
      limit: pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...filters,
    }),
    [page, pageSize, debouncedSearch, filters],
  );

  const query = useQuery<PaginatedResponse<T>>({
    queryKey: keyFactory(params),
    queryFn: () => getList<T>(url, params),
    placeholderData: keepPreviousData,
    enabled,
  });

  return {
    rows: query.data?.data ?? [],
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilter,
    resetFilters,
    params,
  };
}

/**
 * Debounces a value without touching pagination — for screens that manage
 * their own paging.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
