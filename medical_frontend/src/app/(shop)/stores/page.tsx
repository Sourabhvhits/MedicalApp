'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Clock, MapPin, Search, Star, Store } from 'lucide-react';
import { getList } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-list';
import { cn, distanceLabel } from '@/lib/utils';
import { requestBrowserLocation, useLocationStore } from '@/store/location-store';
import type { PaginatedResponse, StoreSummary } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  SkeletonRows,
} from '@/components/ui';
import { Pagination } from '@/components/ui/data-table';

export default function NearbyStoresPage() {
  const { coords, pincode, radiusKm, status, setPincode } = useLocationStore();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim());
  const [openNow, setOpenNow] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'name'>('distance');
  const [page, setPage] = useState(1);
  const [pincodeDraft, setPincodeDraft] = useState('');

  // The query key already contains every filter, so a changed filter fetches
  // page 1 of the new result set as soon as the control resets the page.

  const hasLocation = Boolean(coords || pincode || debounced);

  const params = {
    page,
    limit: 12,
    ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, radius: radiusKm } : {}),
    ...(pincode ? { pincode } : {}),
    ...(debounced ? { search: debounced } : {}),
    ...(openNow ? { openNow: true } : {}),
    sortBy,
  };

  const { data, isLoading, error, refetch } = useQuery<PaginatedResponse<StoreSummary>>({
    queryKey: queryKeys.customer.nearbyStores(params),
    queryFn: () => getList<StoreSummary>('/customers/stores/nearby', params),
    enabled: hasLocation,
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Medical stores near you</h1>
        <p className="mt-1 text-sm text-ink-500">
          Reserve medicines and collect them at a time that suits you.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:min-w-[240px] sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search stores by name or area"
            className="w-full rounded-lg border border-ink-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-brand-600"
          />
        </div>

        <Select
          aria-label="Sort by"
          value={sortBy}
          onChange={(event) => {
            setSortBy(event.target.value as typeof sortBy);
            setPage(1);
          }}
          className="w-36"
          options={[
            { value: 'distance', label: 'Nearest' },
            { value: 'rating', label: 'Top rated' },
            { value: 'name', label: 'A to Z' },
          ]}
        />

        <Button
          variant={openNow ? 'primary' : 'outline'}
          onClick={() => {
            setOpenNow((current) => !current);
            setPage(1);
          }}
        >
          Open now
        </Button>
      </div>

      {!hasLocation ? (
        <Card className="text-center">
          <div className="mx-auto max-w-sm py-8">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700">
              <MapPin className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-ink-900">Where are you?</h2>
            <p className="mt-1 text-sm text-ink-500">
              Share your location or enter a pincode to see medical stores nearby, with live stock.
            </p>

            <Button
              className="mt-5 w-full"
              icon={<MapPin className="h-4 w-4" />}
              loading={status === 'locating'}
              onClick={() => void requestBrowserLocation()}
            >
              Use my current location
            </Button>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-200" />
              <span className="text-xs text-ink-400">or</span>
              <span className="h-px flex-1 bg-ink-200" />
            </div>

            <div className="flex items-end gap-2">
              <Input
                label="Pincode"
                inputMode="numeric"
                placeholder="411001"
                value={pincodeDraft}
                onChange={(event) => setPincodeDraft(event.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => {
                  if (/^\d{6}$/.test(pincodeDraft)) setPincode(pincodeDraft);
                }}
              >
                Search
              </Button>
            </div>
          </div>
        </Card>
      ) : isLoading ? (
        <SkeletonRows rows={4} columns={3} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={<Store className="h-10 w-10" />}
          title="No stores found here"
          description={
            coords
              ? `No approved medical stores within ${radiusKm} km. Try widening the radius from the location picker.`
              : 'No stores match that search. Try a different pincode or store name.'
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((store) => (
              <Link key={store.id} href={`/stores/${store.id}`} className="group">
                <Card className="flex h-full flex-col transition-colors group-hover:border-brand-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-ink-900">
                        {store.storeName}
                      </h2>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {[store.addressLine1, store.landmark, store.city].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    {store.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={store.logoUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Store className="h-5 w-5" />
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={store.isOpen ? 'success' : 'neutral'}>
                      {store.isOpen ? 'Open now' : 'Closed'}
                    </Badge>
                    {store.distanceKm !== null ? (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                        <MapPin className="h-3.5 w-3.5" />
                        {distanceLabel(store.distanceKm)}
                      </span>
                    ) : null}
                    {store.ratingCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {store.ratingAvg.toFixed(1)} ({store.ratingCount})
                      </span>
                    ) : null}
                  </div>

                  <p
                    className={cn(
                      'mt-3 inline-flex items-center gap-1.5 text-xs',
                      store.isOpen ? 'text-ink-500' : 'text-warning',
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {store.openTime && store.closeTime
                      ? `${store.openTime} – ${store.closeTime}`
                      : (store.closedReason ?? 'Hours not set')}
                  </p>

                  <p className="mt-auto pt-4 text-xs font-medium text-brand-700">
                    {store.productCount} product(s) listed →
                  </p>
                </Card>
              </Link>
            ))}
          </div>

          {data.meta.totalPages > 1 ? (
            <div className="mt-5 rounded-xl border border-ink-200 bg-white">
              <Pagination meta={data.meta} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
