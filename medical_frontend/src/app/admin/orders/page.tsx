'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, XCircle } from 'lucide-react';
import { ApiError, getOne, patch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { cn, currency, formatDate, humanize, number, todayISO } from '@/lib/utils';
import type { Order, OrderStatus, PurchaseOrderStatus, SlotCalendarDay } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { RankedBarChart, StatCard, StatusDonutChart, TrendAreaChart } from '@/components/charts';
import { OrderStatusBadge, PaymentStatusBadge, PurchaseStatusBadge } from '@/components/ui/status';
import { ReasonModal } from '@/components/reason-modal';

/** Statuses that still hold a stock reservation — the only ones an admin
 * override (force-cancel, reassign slot) makes sense on. Mirrors the
 * backend's `ORDER_RESERVED_STATUSES` (config/constants.ts). */
const ACTIONABLE_STATUSES: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'];

export default function AdminOrdersPage() {
  const [view, setView] = useState<'list' | 'analytics'>('list');

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every customer order platform-wide — open one to inspect or step in, or switch to analytics."
        action={
          <div className="inline-flex rounded-lg border border-ink-200 bg-white p-1">
            {(['list', 'analytics'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setView(tab)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  view === tab ? 'bg-brand-700 text-white' : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {tab === 'list' ? 'All orders' : 'Analytics'}
              </button>
            ))}
          </div>
        }
      />

      {view === 'list' ? <AllOrdersTab /> : <OrdersAnalyticsTab />}
    </>
  );
}

// ---------------------------------------------------------------------------
// All orders — list, detail, admin overrides
// ---------------------------------------------------------------------------

function AllOrdersTab() {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [reassigning, setReassigning] = useState<Order | null>(null);

  const list = useListQuery<Order>('/admin/orders', queryKeys.admin.orders);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: queryKeys.admin.order(openId ?? ''),
    queryFn: () => getOne<Order>(`/admin/orders/${openId}`),
    enabled: Boolean(openId),
  });

  const invalidate = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.orders({}) });
    if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.admin.order(id) });
  };

  const forceCancel = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      patch(`/admin/orders/${input.id}/cancel`, { reason: input.reason }),
    onSuccess: (_data, variables) => {
      toast.success('Order cancelled');
      setCancelling(null);
      invalidate(variables.id);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not cancel the order');
    },
  });

  const reassignSlot = useMutation({
    mutationFn: (input: { id: string; pickupDate: string; pickupStartTime: string }) =>
      patch(`/admin/orders/${input.id}/reassign-slot`, {
        pickupDate: input.pickupDate,
        pickupStartTime: input.pickupStartTime,
      }),
    onSuccess: (_data, variables) => {
      toast.success('Pickup slot reassigned');
      setReassigning(null);
      invalidate(variables.id);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not reassign the slot');
    },
  });

  const columns: Column<Order>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (order) => (
        <div>
          <p className="font-mono text-sm font-medium text-ink-900">{order.orderNumber}</p>
          <p className="text-xs text-ink-500">{formatDate(order.createdAt, 'dd MMM, HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'store',
      header: 'Store',
      render: (order) => (
        <div>
          <p className="text-sm text-ink-800">{order.retailer.storeName}</p>
          <p className="text-xs text-ink-500">{order.retailer.city ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      hideOnMobile: true,
      render: (order) => (
        <div>
          <p className="text-sm text-ink-800">
            {order.customer
              ? `${order.customer.user.firstName} ${order.customer.user.lastName ?? ''}`.trim()
              : '—'}
          </p>
          <p className="text-xs text-ink-500">{order.customer?.user.phone ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'pickup',
      header: 'Fulfillment',
      hideOnMobile: true,
      render: (order) =>
        order.fulfillmentType === 'DELIVERY' ? (
          <div className="text-xs">
            <Badge tone="brand">Delivery</Badge>
          </div>
        ) : (
          <div className="text-xs">
            <p className="font-medium text-ink-800">{formatDate(order.pickupDate)}</p>
            <p className="text-ink-500">
              {order.pickupStart} – {order.pickupEnd}
            </p>
          </div>
        ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (order) => (
        <div>
          <p className="text-sm font-medium text-ink-900">{currency(order.totalAmount)}</p>
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (order) => (
        <Button variant="ghost" size="sm" onClick={() => setOpenId(order.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(order) => order.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="No orders yet"
        emptyDescription="Orders placed anywhere on the marketplace will appear here."
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Order number, store or customer"
              className="w-full sm:w-72"
            />
            <Select
              aria-label="Status"
              value={(list.filters.status as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('status', event.target.value)}
              className="w-48"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'ACCEPTED', label: 'Accepted' },
                { value: 'PREPARING', label: 'Preparing' },
                { value: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
                { value: 'PICKED_UP', label: 'Picked up' },
                { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
                { value: 'DELIVERED', label: 'Delivered' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
                { value: 'REJECTED', label: 'Rejected' },
                { value: 'EXPIRED', label: 'Expired' },
              ]}
            />
            <Input
              aria-label="From"
              type="date"
              value={(list.filters.dateFrom as string) ?? ''}
              onChange={(event) => list.setFilter('dateFrom', event.target.value)}
              className="w-40"
            />
            <Input
              aria-label="To"
              type="date"
              value={(list.filters.dateTo as string) ?? ''}
              onChange={(event) => list.setFilter('dateTo', event.target.value)}
              className="w-40"
            />
          </FilterBar>
        }
      />

      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={detail?.orderNumber ?? 'Order'}
        description={
          detail
            ? `${detail.retailer.storeName} · ${
                detail.fulfillmentType === 'DELIVERY'
                  ? 'delivery'
                  : `pickup ${formatDate(detail.pickupDate)} ${detail.pickupStart ?? ''}`
              }`
            : undefined
        }
        size="lg"
      >
        {loadingDetail || !detail ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={detail.status} />
              <PaymentStatusBadge status={detail.paymentStatus} />
              <Badge tone="neutral">{humanize(detail.paymentMode)}</Badge>
              {detail.prescriptionUrl ? (
                <a href={detail.prescriptionUrl} target="_blank" rel="noreferrer">
                  <Badge tone="info">View prescription</Badge>
                </a>
              ) : null}
              {detail.prescriptionStatus === 'APPROVED' ? (
                <Badge tone="success">Prescription approved</Badge>
              ) : detail.prescriptionStatus === 'PENDING' ? (
                <Badge tone="warning">Prescription pending review</Badge>
              ) : detail.prescriptionStatus === 'REJECTED' ? (
                <Badge tone="danger">Prescription rejected</Badge>
              ) : null}
            </div>

            {ACTIONABLE_STATUSES.includes(detail.status) ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
                <p className="mr-auto text-sm text-ink-600">Admin override</p>
                {detail.fulfillmentType === 'PICKUP' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<CalendarClock className="h-3.5 w-3.5" />}
                    onClick={() => setReassigning(detail)}
                  >
                    Reassign slot
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="danger"
                  icon={<XCircle className="h-3.5 w-3.5" />}
                  onClick={() => setCancelling(detail)}
                >
                  Force-cancel
                </Button>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Card padded={false} className="p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Store</p>
                <p className="mt-1 text-sm font-medium text-ink-900">{detail.retailer.storeName}</p>
                <p className="text-xs text-ink-500">{detail.retailer.phone}</p>
                <p className="text-xs text-ink-500">
                  {detail.retailer.addressLine1 ?? ''} {detail.retailer.city ?? ''}
                </p>
              </Card>
              <Card padded={false} className="p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Customer</p>
                <p className="mt-1 text-sm font-medium text-ink-900">
                  {detail.customer
                    ? `${detail.customer.user.firstName} ${detail.customer.user.lastName ?? ''}`.trim()
                    : '—'}
                </p>
                <p className="text-xs text-ink-500">{detail.customer?.user.phone ?? ''}</p>
              </Card>
            </div>

            {detail.prescriptionStatus === 'REJECTED' && detail.prescriptionRejectionReason ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-red-800">
                <span className="font-medium">Prescription rejection reason:</span>{' '}
                {detail.prescriptionRejectionReason}
              </p>
            ) : null}

            {detail.customerNote ? (
              <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                <span className="font-medium">Customer note:</span> {detail.customerNote}
              </p>
            ) : null}

            <Card padded={false} className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-50">
                  <tr className="border-b border-ink-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-ink-500">Item</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id} className="border-b border-ink-100 last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink-800">{item.productName}</p>
                        <p className="text-xs text-ink-500">{item.packSize ?? ''}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{number(item.quantity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {currency(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <dl className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Taxable</dt>
                <dd className="tabular-nums">{currency(detail.taxableAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">CGST + SGST</dt>
                <dd className="tabular-nums">{currency(detail.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{currency(detail.totalAmount)}</dd>
              </div>
            </dl>

            {detail.statusHistory && detail.statusHistory.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Timeline</h3>
                <ol className="space-y-2">
                  {detail.statusHistory.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                      <span>
                        <span className="font-medium text-ink-800">{humanize(entry.toStatus)}</span>
                        <span className="ml-2 text-xs text-ink-500">
                          {formatDate(entry.createdAt, 'dd MMM, HH:mm')}
                        </span>
                        {entry.notes ? <span className="block text-xs text-ink-500">{entry.notes}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <ReasonModal
        subject={cancelling}
        title="Force-cancel order"
        description={(order) =>
          `${order.orderNumber} — reserved stock is released and both the store and customer are notified.`
        }
        confirmLabel="Cancel order"
        placeholder="Why is this order being cancelled by admin?"
        loading={forceCancel.isPending}
        onClose={() => setCancelling(null)}
        onSubmit={(reason) => cancelling && forceCancel.mutate({ id: cancelling.id, reason })}
      />

      <ReassignSlotModal
        order={reassigning}
        loading={reassignSlot.isPending}
        onClose={() => setReassigning(null)}
        onSubmit={(pickupDate, pickupStartTime) =>
          reassigning && reassignSlot.mutate({ id: reassigning.id, pickupDate, pickupStartTime })
        }
      />
    </>
  );
}

/** Day-strip + slot-grid picker for reassigning an order to a different
 * pickup slot at its own store — same calendar data the customer checkout
 * flow already reads (`/customers/stores/{id}/pickup-slots`). */
function ReassignSlotModal({
  order,
  loading,
  onClose,
  onSubmit,
}: {
  order: Order | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (pickupDate: string, pickupStartTime: string) => void;
}) {
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [chosenTime, setChosenTime] = useState<string | null>(null);

  const { data: calendar, isLoading } = useQuery({
    queryKey: ['admin', 'order', order?.id ?? '', 'slots'],
    queryFn: () => getOne<SlotCalendarDay[]>(`/customers/stores/${order!.retailer.id}/pickup-slots`, { days: 7 }),
    enabled: Boolean(order),
  });

  const pickupDate = chosenDate ?? calendar?.find((day) => !day.isClosed && day.availableCount > 0)?.date ?? '';
  const selectedDay = calendar?.find((day) => day.date === pickupDate);

  return (
    <Modal
      open={Boolean(order)}
      onClose={() => {
        setChosenDate(null);
        setChosenTime(null);
        onClose();
      }}
      title="Reassign pickup slot"
      description={order ? `${order.orderNumber} — ${order.retailer.storeName}` : undefined}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!pickupDate || !chosenTime}
            onClick={() => chosenTime && onSubmit(pickupDate, chosenTime)}
          >
            Reassign
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingBlock />
      ) : !calendar || calendar.every((day) => day.availableCount === 0) ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-amber-900">
          This store has no free pickup slots in the next week.
        </p>
      ) : (
        <>
          <div className="scroll-thin -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {calendar.map((day) => {
              const disabled = day.isClosed || day.availableCount === 0;
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setChosenDate(day.date);
                    setChosenTime(null);
                  }}
                  className={cn(
                    'min-w-24 shrink-0 rounded-lg border px-3 py-2 text-center transition-colors',
                    pickupDate === day.date
                      ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                      : disabled
                        ? 'cursor-not-allowed border-ink-200 bg-ink-100 text-ink-400'
                        : 'border-ink-200 bg-white hover:border-brand-300',
                  )}
                >
                  <span className="block text-xs">{formatDate(day.date, 'EEE')}</span>
                  <span className="block text-sm font-semibold">{formatDate(day.date, 'dd MMM')}</span>
                  <span className="mt-0.5 block text-[11px]">
                    {day.isClosed ? 'Closed' : day.availableCount > 0 ? `${day.availableCount} slots` : 'Full'}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedDay && !selectedDay.isClosed ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectedDay.slots.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!option.available}
                  title={option.reason}
                  onClick={() => setChosenTime(option.startTime)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-sm transition-colors',
                    chosenTime === option.startTime
                      ? 'border-brand-600 bg-brand-700 text-white'
                      : option.available
                        ? 'border-ink-200 bg-white hover:border-brand-300'
                        : 'cursor-not-allowed border-ink-200 bg-ink-100 text-ink-400',
                  )}
                >
                  {option.startTime}
                  <span className="block text-[11px] opacity-80">
                    {option.available ? `${option.capacity - option.bookedCount} left` : (option.reason ?? 'Unavailable')}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

interface OrderAnalytics {
  customerOrders: { status: OrderStatus; count: number; amount: number }[];
  vendorOrders: { status: PurchaseOrderStatus; count: number; amount: number }[];
  byStore: { store: string; orders: number; amount: number }[];
  byDay: { day: string; orders: number; amount: number }[];
}

function OrdersAnalyticsTab() {
  const [dateFrom, setDateFrom] = useState(todayISO(-29));
  const [dateTo, setDateTo] = useState(todayISO());

  const params = { dateFrom, dateTo };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.reports.run('admin', 'orders', params),
    queryFn: () => getOne<OrderAnalytics>('/admin/reports/orders', params),
  });

  if (isLoading) return <LoadingBlock />;
  if (error || !data) {
    return <ErrorState message={(error as Error)?.message ?? 'Failed to load'} onRetry={() => void refetch()} />;
  }

  const customerTotal = data.customerOrders.reduce((sum, row) => sum + row.count, 0);
  const customerValue = data.customerOrders.reduce((sum, row) => sum + row.amount, 0);
  const vendorTotal = data.vendorOrders.reduce((sum, row) => sum + row.count, 0);
  const vendorValue = data.vendorOrders.reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      <div className="mb-4 flex items-end gap-2">
        <Input
          label="From"
          type="date"
          value={dateFrom}
          max={dateTo}
          onChange={(event) => setDateFrom(event.target.value)}
          className="w-40"
        />
        <Input
          label="To"
          type="date"
          value={dateTo}
          min={dateFrom}
          max={todayISO()}
          onChange={(event) => setDateTo(event.target.value)}
          className="w-40"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Customer orders" value={number(customerTotal)} tone="brand" />
        <StatCard label="Customer order value" value={currency(customerValue)} tone="success" />
        <StatCard label="Wholesale orders" value={number(vendorTotal)} tone="info" />
        <StatCard label="Wholesale order value" value={currency(vendorValue)} tone="success" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <TrendAreaChart
          title="Order value per day"
          description="Customer orders placed"
          data={data.byDay.map((row) => ({ day: row.day, value: row.amount }))}
          className="lg:col-span-2"
        />
        <StatusDonutChart
          title="Customer orders by status"
          data={data.customerOrders.map((row) => ({ label: humanize(row.status), value: row.count }))}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Customer orders by status" />
          {data.customerOrders.length === 0 ? (
            <EmptyState title="No customer orders in this period" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.customerOrders.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-4 py-2.5">
                  <OrderStatusBadge status={row.status} />
                  <span className="text-right">
                    <span className="block text-sm font-semibold text-ink-900">{number(row.count)}</span>
                    <span className="block text-xs text-ink-500">{currency(row.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Wholesale orders by status" />
          {data.vendorOrders.length === 0 ? (
            <EmptyState title="No wholesale orders in this period" />
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.vendorOrders.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-4 py-2.5">
                  <PurchaseStatusBadge status={row.status} />
                  <span className="text-right">
                    <span className="block text-sm font-semibold text-ink-900">{number(row.count)}</span>
                    <span className="block text-xs text-ink-500">{currency(row.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <RankedBarChart
          title="Orders by store"
          description="Order value per medical shop"
          data={data.byStore.map((row) => ({ name: row.store, amount: row.amount }))}
          valueKey="amount"
        />
      </div>
    </>
  );
}
