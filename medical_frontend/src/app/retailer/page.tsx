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
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { getOne } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { currency, number } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { RetailerDashboard } from '@/lib/types';
import { ErrorState, PageHeader, Select, SkeletonRows } from '@/components/ui';
import { RankedBarChart, StatCard, TrendAreaChart } from '@/components/charts';

export default function RetailerDashboardPage() {
  const [days, setDays] = useState(30);
  const user = useAuthStore((state) => state.user);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.retailer.dashboard(days),
    queryFn: () => getOne<RetailerDashboard>('/retailer/dashboard', { days }),
  });

  if (error) return <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />;

  const cards = data?.cards;
  const pendingApproval = user?.approvalStatus && user.approvalStatus !== 'APPROVED';

  return (
    <>
      <PageHeader
        title="Store dashboard"
        description="Today's trade, stock health and what needs your attention."
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
          <p className="font-semibold">Your store is awaiting approval.</p>
          <p className="mt-1">
            Customers cannot see your store yet. Complete your licence details and upload documents.{' '}
            <Link href="/retailer/store" className="font-medium underline">
              Go to store profile
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
              label="Today's sales"
              value={currency(cards.todaysSales)}
              hint={`${number(cards.todaysOrders)} orders today`}
              icon={<IndianRupee className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Pending orders"
              value={number(cards.pendingOrders)}
              hint="Need accepting or preparing"
              icon={<ShoppingBag className="h-5 w-5" />}
              tone="warning"
              href="/retailer/orders?active=true"
            />
            <StatCard
              label="Products listed"
              value={number(cards.totalProducts)}
              icon={<Package className="h-5 w-5" />}
              href="/retailer/products"
            />
            <StatCard
              label="Stock on hand"
              value={number(cards.currentStock)}
              hint="Units across all batches"
              icon={<Boxes className="h-5 w-5" />}
              href="/retailer/inventory"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Low stock"
              value={number(cards.lowStock)}
              hint="At or below minimum level"
              icon={<AlertTriangle className="h-5 w-5" />}
              tone="warning"
              href="/retailer/inventory"
            />
            <StatCard
              label="Expiring soon"
              value={number(cards.expiringProducts)}
              hint="Batches expiring within 90 days"
              icon={<CalendarX2 className="h-5 w-5" />}
              tone="danger"
              href="/retailer/inventory"
            />
            <StatCard
              label="Open purchases"
              value={number(cards.pendingPurchases)}
              hint="Orders placed with wholesalers"
              icon={<Truck className="h-5 w-5" />}
              tone="info"
              href="/retailer/purchases"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <TrendAreaChart
              title="Daily sales"
              description="Completed customer orders"
              data={data.charts.dailySales}
            />
            <TrendAreaChart
              title="Monthly sales"
              description="Last 12 months"
              data={data.charts.monthlySales}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <RankedBarChart
              title="Top products"
              description="Units sold in the selected period"
              data={data.charts.topProducts}
              valueKey="quantity"
              isCurrency={false}
            />
            <RankedBarChart
              title="Revenue by product"
              data={data.charts.topProducts}
              valueKey="revenue"
            />
          </div>

          <div className="mt-4">
            <TrendAreaChart
              title="Stock movement"
              description="Units received into the store"
              data={data.charts.stockMovement
                .filter((row) => row.direction === 'IN')
                .map((row) => ({ day: row.day, value: row.quantity }))}
              isCurrency={false}
              valueLabel="Units"
            />
          </div>

          <p className="mt-6 flex items-center gap-2 text-xs text-ink-500">
            <ClipboardList className="h-3.5 w-3.5" />
            Sales figures count picked-up and completed orders only — reserved stock is not revenue
            until the customer collects it.
          </p>
        </>
      )}
    </>
  );
}
