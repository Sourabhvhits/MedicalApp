'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CalendarX2,
  ClipboardCheck,
  IndianRupee,
  Package,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react';
import { getOne } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { currency, number } from '@/lib/utils';
import type { AdminDashboard } from '@/lib/types';
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Select, SkeletonRows } from '@/components/ui';
import { RankedBarChart, StatCard, TrendAreaChart, TrendLineChart } from '@/components/charts';

const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function AdminDashboardPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.admin.dashboard(days),
    queryFn: () => getOne<AdminDashboard>('/admin/dashboard', { days }),
  });

  if (error) {
    return <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />;
  }

  const cards = data?.cards;

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Marketplace activity, approvals and inventory risk across every store and wholesaler."
        action={
          <Select
            aria-label="Date range"
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
            options={RANGE_OPTIONS}
            className="w-40"
          />
        }
      />

      {cards && cards.pendingApprovals > 0 ? (
        <Link
          href="/admin/vendors?approvalStatus=PENDING"
          className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-100"
        >
          <ClipboardCheck className="h-5 w-5 shrink-0" />
          <span>
            <span className="font-semibold">{cards.pendingApprovals} business account(s)</span> are
            waiting for review — {cards.pendingVendorApprovals} wholesaler(s) and{' '}
            {cards.pendingShopApprovals} medical shop(s).
          </span>
        </Link>
      ) : null}

      {isLoading || !cards ? (
        <SkeletonRows rows={3} columns={5} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Today's sales"
              value={currency(cards.todaysSales)}
              hint={`${number(cards.todaysOrders)} orders today`}
              icon={<IndianRupee className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Total orders"
              value={number(cards.totalOrders)}
              hint="All customer orders"
              icon={<ShoppingCart className="h-5 w-5" />}
              tone="info"
            />
            <StatCard
              label="Medical shops"
              value={number(cards.totalShops)}
              hint="Approved and trading"
              icon={<Store className="h-5 w-5" />}
              href="/admin/retailers"
            />
            <StatCard
              label="Wholesalers"
              value={number(cards.totalVendors)}
              hint="Approved suppliers"
              icon={<Building2 className="h-5 w-5" />}
              href="/admin/vendors"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Customers"
              value={number(cards.totalCustomers)}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Master products"
              value={number(cards.totalProducts)}
              icon={<Package className="h-5 w-5" />}
              href="/admin/products"
            />
            <StatCard
              label="Low stock"
              value={number(cards.lowStockProducts)}
              hint="Across all stores and warehouses"
              icon={<AlertTriangle className="h-5 w-5" />}
              tone="warning"
            />
            <StatCard
              label="Expiring / expired"
              value={`${number(cards.expiringProducts)} / ${number(cards.expiredProducts)}`}
              hint="Batches within 30 days / already expired"
              icon={<CalendarX2 className="h-5 w-5" />}
              tone="danger"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TrendAreaChart
              title="Sales trend"
              description="Completed customer orders"
              data={data.charts.salesTrend}
            />
            <TrendLineChart
              title="Order volume"
              description="Orders placed per day"
              data={data.charts.ordersTrend}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <RankedBarChart
              title="Top stores by revenue"
              data={data.charts.topStores}
              valueKey="revenue"
            />
            <RankedBarChart
              title="Top products by units sold"
              data={data.charts.topProducts}
              valueKey="quantity"
              isCurrency={false}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TrendLineChart
              title="New medical shops"
              description="Registrations per day"
              data={data.charts.newStores}
            />
            <TrendLineChart
              title="New wholesalers"
              description="Registrations per day"
              data={data.charts.newVendors}
            />
          </div>

          <Card className="mt-4">
            <CardHeader
              title="Top stores"
              description="Ranked by revenue in the selected period"
            />
            {data.charts.topStores.length === 0 ? (
              <EmptyState title="No store activity yet" />
            ) : (
              <ol className="divide-y divide-ink-100">
                {data.charts.topStores.map((store, index) => (
                  <li key={store.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-ink-800">{store.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold text-ink-900">
                        {currency(store.revenue)}
                      </span>
                      <span className="block text-xs text-ink-500">{store.orders} orders</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
      )}
    </>
  );
}
