'use client';

import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ClipboardList, Clock, MapPin } from 'lucide-react';
import { getList } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { currency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { Order, PaginatedResponse } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Select,
  SkeletonRows,
} from '@/components/ui';
import { Pagination } from '@/components/ui/data-table';
import { OrderStatusBadge } from '@/components/ui/status';

export default function CustomerOrdersPage() {
  const { user, initialised } = useAuthStore();
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);

  const params = { page, limit: 10, ...(status !== 'ALL' ? { status } : {}) };

  const { data, isLoading, error, refetch } = useQuery<PaginatedResponse<Order>>({
    queryKey: queryKeys.customer.orders(params),
    queryFn: () => getList<Order>('/customers/orders', params),
    enabled: Boolean(user),
    placeholderData: keepPreviousData,
  });

  if (!initialised) return <LoadingBlock />;

  if (!user) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-10 w-10" />}
        title="Sign in to see your orders"
        action={
          <Link href="/login?next=/orders">
            <Button>Sign in</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Your orders</h1>
          <p className="mt-1 text-sm text-ink-500">Track pickups and revisit past purchases.</p>
        </div>
        <Select
          aria-label="Filter orders"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="w-48"
          options={[
            { value: 'ALL', label: 'All orders' },
            { value: 'PENDING', label: 'Awaiting store' },
            { value: 'ACCEPTED', label: 'Accepted' },
            { value: 'PREPARING', label: 'Being prepared' },
            { value: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
      </header>

      {isLoading ? (
        <SkeletonRows rows={4} columns={2} />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-10 w-10" />}
          title="No orders yet"
          description="Once you reserve medicines from a store, your orders will appear here."
          action={
            <Link href="/stores">
              <Button>Find a store</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.data.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="block">
                <Card className="transition-colors hover:border-brand-300">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-ink-900">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-700">
                        <MapPin className="h-3.5 w-3.5 text-ink-400" />
                        {order.retailer.storeName}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-500">
                        <Clock className="h-3.5 w-3.5" />
                        {order.fulfillmentType === 'DELIVERY'
                          ? 'Delivery'
                          : `Pickup ${formatDate(order.pickupDate)} · ${order.pickupStart} – ${order.pickupEnd}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <OrderStatusBadge status={order.status} />
                      <p className="mt-1.5 text-base font-semibold text-ink-900">
                        {currency(order.totalAmount)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {order._count?.items ?? order.items?.length ?? 0} item(s)
                      </p>
                    </div>
                  </div>
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
