'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  CalendarX2,
  ClipboardList,
  IndianRupee,
  Package,
  Wallet,
} from 'lucide-react';
import { getOne } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { currency, number } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { VendorDashboard } from '@/lib/types';
import { ErrorState, PageHeader, Select, SkeletonRows } from '@/components/ui';
import { RankedBarChart, StatCard, TrendAreaChart, TrendLineChart } from '@/components/charts';

export default function VendorDashboardPage() {
  const [days, setDays] = useState(30);
  const user = useAuthStore((state) => state.user);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.vendor.dashboard(days),
    queryFn: () => getOne<VendorDashboard>('/vendor/dashboard', { days }),
  });

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />;

  const cards = data?.cards;
  const pendingApproval = user?.approvalStatus && user.approvalStatus !== 'APPROVED';

  return (
    <>
      <PageHeader
        title="Wholesale dashboard"
        description="Orders from medical shops, stock health and payments at a glance."
        action={
          <Select
            aria-label="Date range"
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
            className="w-40"
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
        }
      />

      {pendingApproval ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Your account is awaiting approval.</p>
          <p className="mt-1">
            You can prepare your catalogue and stock, but retailers will not see your products until
            a platform admin approves your licence documents.{' '}
            <Link href="/vendor/profile" className="font-medium underline">
              Complete your profile
            </Link>
          </p>
        </div>
      ) : null}

      {isLoading || !cards ? (
        <SkeletonRows rows={3} columns={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Today's orders"
              value={number(cards.todaysOrders)}
              hint={`${number(cards.pendingOrders)} awaiting action`}
              icon={<ClipboardList className="h-5 w-5" />}
              tone="brand"
              href="/vendor/orders"
            />
            <StatCard
              label="Total sales"
              value={currency(cards.totalSales)}
              hint="Delivered and completed orders"
              icon={<IndianRupee className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Pending payments"
              value={currency(cards.pendingPayments)}
              hint="Outstanding from retailers"
              icon={<Wallet className="h-5 w-5" />}
              tone="warning"
              href="/vendor/finance"
            />
            <StatCard
              label="Catalogue"
              value={number(cards.totalProducts)}
              hint="Active listings"
              icon={<Package className="h-5 w-5" />}
              href="/vendor/products"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total stock"
              value={number(cards.totalStock)}
              hint="Units across all batches"
              icon={<Boxes className="h-5 w-5" />}
              href="/vendor/inventory"
            />
            <StatCard
              label="Low stock"
              value={number(cards.lowStock)}
              hint="Products below minimum level"
              icon={<AlertTriangle className="h-5 w-5" />}
              tone="warning"
              href="/vendor/inventory?view=low-stock"
            />
            <StatCard
              label="Expiring stock"
              value={number(cards.expiringStock)}
              hint="Batches expiring within 90 days"
              icon={<CalendarX2 className="h-5 w-5" />}
              tone="danger"
              href="/vendor/inventory?view=expiry"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TrendAreaChart
              title="Wholesale revenue"
              description="Delivered order value per day"
              data={data.charts.salesTrend}
            />
            <TrendLineChart
              title="Orders received"
              description="Purchase orders per day"
              data={data.charts.ordersTrend}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <RankedBarChart
              title="Top products"
              description="Units ordered by retailers"
              data={data.charts.topProducts}
              valueKey="quantity"
              isCurrency={false}
            />
            <RankedBarChart
              title="Top retailers"
              description="Order value per medical shop"
              data={data.charts.topRetailers}
              valueKey="amount"
            />
          </div>
        </>
      )}
    </>
  );
}
