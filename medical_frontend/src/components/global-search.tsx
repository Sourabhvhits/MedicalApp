'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { getOne } from '@/lib/api-client';
import { useDebouncedValue } from '@/hooks/use-list';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface GlobalSearchResults {
  products: SearchResult[];
  vendors: SearchResult[];
  retailers: SearchResult[];
  users: SearchResult[];
  orders: SearchResult[];
}

const GROUP_LABELS: Record<keyof GlobalSearchResults, string> = {
  vendors: 'Wholesalers',
  retailers: 'Medical shops',
  users: 'Users',
  orders: 'Orders',
  products: 'Products',
};

/** Admin top-bar cross-entity search (TASKS.md #17) — fans out to `/admin/search`. */
export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 300);

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'search', debounced],
    queryFn: () => getOne<GlobalSearchResults>('/admin/search', { q: debounced }),
    enabled: debounced.trim().length >= 2,
  });

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const groups = data
    ? (Object.keys(GROUP_LABELS) as (keyof GlobalSearchResults)[])
        .map((key) => ({ key, label: GROUP_LABELS[key], items: data[key] }))
        .filter((group) => group.items.length > 0)
    : [];

  const showDropdown = open && debounced.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-sm sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search vendors, shops, orders, products, users…"
        className="w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-600"
      />

      {showDropdown ? (
        <div className="scroll-thin absolute left-0 top-full z-40 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-lg">
          {isFetching ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : groups.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-500">No matches for &ldquo;{debounced}&rdquo;</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="border-b border-ink-100 py-1.5 last:border-0">
                <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setQuery('');
                      router.push(item.href);
                    }}
                    className={cn(
                      'flex w-full flex-col items-start px-4 py-2 text-left text-sm hover:bg-ink-50',
                    )}
                  >
                    <span className="font-medium text-ink-900">{item.title}</span>
                    <span className="text-xs text-ink-500">{item.subtitle}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
