'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Plus, Search, Store } from 'lucide-react';
import { ApiError, getList, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-list';
import { currency, distanceLabel } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useLocationStore } from '@/store/location-store';
import type { PaginatedResponse, Product } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  SkeletonRows,
} from '@/components/ui';
import { Pagination } from '@/components/ui/data-table';

interface SearchResult {
  retailerProductId: string;
  sellingPrice: number;
  mrp: number;
  discountPct: number;
  availableQty: number;
  distanceKm: number | null;
  product: Pick<Product, 'id' | 'name' | 'genericName' | 'brandName' | 'packSize' | 'prescriptionRequired'> & {
    manufacturer?: { name: string } | null;
  };
  store: { id: string; storeName: string; city: string | null; pincode: string | null; ratingAvg: number };
}

interface SearchSubstitute {
  retailerProductId: string;
  sellingPrice: number;
  mrp: number;
  availableQty: number;
  distanceKm: number | null;
  product: { id: string; name: string; genericName: string | null; brandName: string | null };
  store: { id: string; storeName: string };
}

interface SearchResponse extends PaginatedResponse<SearchResult> {
  substitutes?: SearchSubstitute[];
}

export default function ProductSearchPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { coords, radiusKm } = useLocationStore();

  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term.trim(), 400);
  const [page, setPage] = useState(1);
  const [conflict, setConflict] = useState<{ id: string; message: string } | null>(null);

  const params = {
    page,
    limit: 15,
    search: debounced,
    ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, radius: radiusKm } : {}),
  };

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: queryKeys.customer.productSearch(params),
    queryFn: () => getList<SearchResult>('/customers/products/search', params) as Promise<SearchResponse>,
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  });

  const addToCart = useMutation({
    mutationFn: (input: { retailerProductId: string; replaceCart?: boolean }) =>
      post('/customers/cart/items', {
        retailerProductId: input.retailerProductId,
        quantity: 1,
        replaceCart: input.replaceCart ?? false,
      }),
    onSuccess: () => {
      toast.success('Added to cart');
      setConflict(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.cart });
    },
    onError: (error, variables) => {
      if (error instanceof ApiError && error.code === 'CART_STORE_CONFLICT') {
        setConflict({ id: variables.retailerProductId, message: error.message });
        return;
      }
      toast.error(error instanceof ApiError ? error.message : 'Could not add to cart');
    },
  });

  return (
    <>
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Find a medicine</h1>
        <p className="mt-1 text-sm text-ink-500">
          Search by brand or generic name to see which nearby stores have it in stock.
        </p>
      </header>

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          autoFocus
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setPage(1);
          }}
          placeholder="Paracetamol, Azithromycin, thermometer…"
          className="w-full rounded-lg border border-ink-300 bg-white py-3 pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-brand-600"
        />
      </div>

      {!coords ? (
        <p className="mb-4 rounded-lg bg-info-soft px-3 py-2 text-sm text-blue-900">
          Set your location from the header to see distances and limit results to stores near you.
        </p>
      ) : null}

      {debounced.length < 2 ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="Start typing to search"
          description="We look across every approved store near you and show only what is genuinely in stock."
        />
      ) : isLoading ? (
        <SkeletonRows rows={5} columns={3} />
      ) : !data || data.data.length === 0 ? (
        <>
          <EmptyState
            title={`Nothing in stock for "${debounced}"`}
            description="Try the generic name, widen your search radius, or check back later."
          />
          {data?.substitutes && data.substitutes.length > 0 ? (
            <div className="mt-5">
              <p className="mb-3 text-sm font-medium text-ink-700">
                Not available — similar alternatives with the same composition:
              </p>
              <div className="space-y-3">
                {data.substitutes.map((sub) => (
                  <Card key={sub.retailerProductId} className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-ink-900">{sub.product.name}</h2>
                      <p className="mt-0.5 text-xs text-ink-500">{sub.product.brandName ?? ''}</p>
                      <Link
                        href={`/stores/${sub.store.id}`}
                        className="mt-2 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600 hover:text-brand-700"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Store className="h-3.5 w-3.5" />
                          {sub.store.storeName}
                        </span>
                        {sub.distanceKm !== null ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {distanceLabel(sub.distanceKm)}
                          </span>
                        ) : null}
                        <span>{sub.availableQty} in stock</span>
                      </Link>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-ink-900">{currency(sub.sellingPrice)}</p>
                      {sub.sellingPrice < sub.mrp ? (
                        <p className="text-xs text-ink-400 line-through">{currency(sub.mrp)}</p>
                      ) : null}
                      <Button
                        size="sm"
                        className="mt-2"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        loading={
                          addToCart.isPending &&
                          addToCart.variables?.retailerProductId === sub.retailerProductId
                        }
                        onClick={() => {
                          if (!user) {
                            router.push('/login?next=/search');
                            return;
                          }
                          addToCart.mutate({ retailerProductId: sub.retailerProductId });
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="space-y-3">
            {data.data.map((result) => (
              <Card key={result.retailerProductId} className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h2 className="text-sm font-semibold text-ink-900">{result.product.name}</h2>
                    {result.product.prescriptionRequired ? <Badge tone="warning">Rx</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {[result.product.brandName, result.product.packSize, result.product.manufacturer?.name]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  <Link
                    href={`/stores/${result.store.id}`}
                    className="mt-2 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600 hover:text-brand-700"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Store className="h-3.5 w-3.5" />
                      {result.store.storeName}
                    </span>
                    {result.distanceKm !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {distanceLabel(result.distanceKm)}
                      </span>
                    ) : null}
                    <span>{result.availableQty} in stock</span>
                  </Link>
                </div>

                <div className="text-right">
                  <p className="text-base font-semibold text-ink-900">
                    {currency(result.sellingPrice)}
                  </p>
                  {result.sellingPrice < result.mrp ? (
                    <p className="text-xs text-ink-400 line-through">{currency(result.mrp)}</p>
                  ) : null}
                  <Button
                    size="sm"
                    className="mt-2"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    loading={
                      addToCart.isPending &&
                      addToCart.variables?.retailerProductId === result.retailerProductId
                    }
                    onClick={() => {
                      if (!user) {
                        router.push('/login?next=/search');
                        return;
                      }
                      addToCart.mutate({ retailerProductId: result.retailerProductId });
                    }}
                  >
                    Add
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {data.meta.totalPages > 1 ? (
            <div className="mt-5 rounded-xl border border-ink-200 bg-white">
              <Pagination meta={data.meta} onPageChange={setPage} />
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        onConfirm={() =>
          conflict && addToCart.mutate({ retailerProductId: conflict.id, replaceCart: true })
        }
        title="Start a new cart?"
        message={
          conflict?.message ??
          'A cart can only contain items from one store. Starting a new cart clears the current one.'
        }
        confirmLabel="Start a new cart"
        tone="primary"
        loading={addToCart.isPending}
      />
    </>
  );
}
