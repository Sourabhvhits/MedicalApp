'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { ApiError, getList, getOne, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-list';
import { cn, currency, DAY_NAMES, formatDate, percent } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { BusinessHour, PaginatedResponse, StoreProduct } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingBlock,
  SkeletonRows,
} from '@/components/ui';
import { Pagination } from '@/components/ui/data-table';

interface StoreDetail {
  id: string;
  storeName: string;
  description: string | null;
  logoUrl: string | null;
  phone: string;
  addressLine1: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  ratingAvg: number;
  ratingCount: number;
  drugLicenseNumber: string | null;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  closedReason?: string;
  isTemporarilyClosed: boolean;
  productCount: number;
  businessHours: BusinessHour[];
  holidays: { id: string; date: string; title: string | null }[];
  images: { id: string; url: string; caption: string | null }[];
}

export default function StoreDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [conflict, setConflict] = useState<{ productId: string; message: string } | null>(null);

  const { data: store, isLoading, error } = useQuery({
    queryKey: queryKeys.customer.store(params.id),
    queryFn: () => getOne<StoreDetail>(`/customers/stores/${params.id}`),
  });

  const productParams = {
    page,
    limit: 12,
    inStockOnly: false,
    ...(debounced ? { search: debounced } : {}),
  };

  const { data: products, isLoading: loadingProducts } = useQuery<PaginatedResponse<StoreProduct>>({
    queryKey: queryKeys.customer.storeProducts(params.id, productParams),
    queryFn: () => getList<StoreProduct>(`/customers/stores/${params.id}/products`, productParams),
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
        setConflict({ productId: variables.retailerProductId, message: error.message });
        return;
      }
      toast.error(error instanceof ApiError ? error.message : 'Could not add to cart');
    },
  });

  const handleAdd = (product: StoreProduct) => {
    if (!user) {
      router.push(`/login?next=/stores/${params.id}`);
      return;
    }
    addToCart.mutate({ retailerProductId: product.id });
  };

  if (isLoading) return <LoadingBlock />;
  if (error || !store) {
    return <ErrorState message={(error as Error)?.message ?? 'Store not found'} />;
  }

  return (
    <>
      <Link
        href="/stores"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All stores
      </Link>

      <Card className="mb-5">
        <div className="flex flex-wrap items-start gap-4">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ) : null}

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-ink-900">{store.storeName}</h1>
            {store.description ? (
              <p className="mt-1 text-sm text-ink-600">{store.description}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-600">
              <Badge tone={store.isOpen ? 'success' : 'neutral'}>
                {store.isOpen ? 'Open now' : 'Closed'}
              </Badge>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-ink-400" />
                {store.openTime && store.closeTime
                  ? `${store.openTime} – ${store.closeTime}`
                  : (store.closedReason ?? 'Hours not published')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-ink-400" />
                {store.phone}
              </span>
              {store.ratingCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {store.ratingAvg.toFixed(1)} ({store.ratingCount})
                </span>
              ) : null}
            </div>

            <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-ink-500">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              {[store.addressLine1, store.landmark, store.city, store.state, store.pincode]
                .filter(Boolean)
                .join(', ')}
            </p>

            {store.drugLicenseNumber ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Drug licence {store.drugLicenseNumber} — verified by the platform
              </p>
            ) : null}
          </div>
        </div>

        {store.isTemporarilyClosed ? (
          <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-amber-900">
            This store is temporarily closed and is not accepting orders right now.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-4">
        <aside className="order-2 space-y-4 lg:order-1 lg:col-span-1">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Opening hours</h2>
            <ul className="space-y-1.5 text-sm">
              {store.businessHours.map((hour) => (
                <li key={hour.dayOfWeek} className="flex justify-between gap-2">
                  <span className="text-ink-600">{DAY_NAMES[hour.dayOfWeek].slice(0, 3)}</span>
                  <span className={hour.isClosed ? 'text-ink-400' : 'text-ink-800'}>
                    {hour.isClosed ? 'Closed' : `${hour.openTime} – ${hour.closeTime}`}
                  </span>
                </li>
              ))}
            </ul>

            {store.holidays.length > 0 ? (
              <>
                <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Upcoming closures
                </h3>
                <ul className="space-y-1 text-xs text-ink-600">
                  {store.holidays.slice(0, 5).map((holiday) => (
                    <li key={holiday.id}>
                      {formatDate(holiday.date, 'dd MMM')} — {holiday.title ?? 'Holiday'}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
        </aside>

        <section className="order-1 lg:order-2 lg:col-span-3">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search medicines in this store"
              className="w-full rounded-lg border border-ink-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-brand-600"
            />
          </div>

          {loadingProducts ? (
            <SkeletonRows rows={5} columns={3} />
          ) : !products || products.data.length === 0 ? (
            <EmptyState
              title="Nothing in stock matching that"
              description="Try another search term, or browse other stores nearby."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {products.data.map((item) => (
                  <Card key={item.id} className="flex flex-col">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-ink-900">{item.product.name}</h3>
                        {item.product.prescriptionRequired ? (
                          <Badge tone="warning">Rx</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {[item.product.brandName, item.product.packSize].filter(Boolean).join(' · ')}
                      </p>
                      {item.product.manufacturer ? (
                        <p className="text-xs text-ink-400">{item.product.manufacturer.name}</p>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-ink-900">
                          {currency(item.sellingPrice)}
                        </p>
                        {item.sellingPrice < item.mrp ? (
                          <p className="text-xs text-ink-500">
                            <span className="line-through">{currency(item.mrp)}</span>{' '}
                            <span className="text-success">
                              {percent(((item.mrp - item.sellingPrice) / item.mrp) * 100, 0)} off
                            </span>
                          </p>
                        ) : null}
                        <p
                          className={cn(
                            'mt-0.5 text-xs',
                            !item.inStock
                              ? 'text-danger'
                              : item.availableQty > 10
                                ? 'text-ink-500'
                                : 'text-warning',
                          )}
                        >
                          {!item.inStock
                            ? 'Out of stock'
                            : item.availableQty > 10
                              ? 'In stock'
                              : `Only ${item.availableQty} left`}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        disabled={store.isTemporarilyClosed || !item.inStock}
                        loading={addToCart.isPending && addToCart.variables?.retailerProductId === item.id}
                        onClick={() => handleAdd(item)}
                      >
                        Add
                      </Button>
                    </div>

                    {!item.inStock && item.substitutes.length > 0 ? (
                      <div className="mt-3 border-t border-ink-100 pt-3">
                        <p className="mb-1.5 text-xs font-medium text-ink-600">
                          Not available — similar alternatives:
                        </p>
                        <ul className="space-y-1">
                          {item.substitutes.map((sub) => (
                            <li
                              key={sub.productId}
                              className="flex items-center justify-between gap-2 text-xs text-ink-700"
                            >
                              <span className="truncate">
                                {sub.name}
                                {sub.brandName ? ` (${sub.brandName})` : ''}
                              </span>
                              <span className="shrink-0 font-medium">{currency(sub.sellingPrice)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>

              {products.meta.totalPages > 1 ? (
                <div className="mt-5 rounded-xl border border-ink-200 bg-white">
                  <Pagination meta={products.meta} onPageChange={setPage} />
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        onConfirm={() =>
          conflict && addToCart.mutate({ retailerProductId: conflict.productId, replaceCart: true })
        }
        title="Start a new cart?"
        message={
          conflict?.message ??
          'Your cart contains items from another store. A cart can only hold items from one store.'
        }
        confirmLabel="Start a new cart"
        tone="primary"
        loading={addToCart.isPending}
      />
    </>
  );
}
