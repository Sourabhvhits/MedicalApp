'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, PackageCheck, Truck, X } from 'lucide-react';
import { ApiError, getOne, patch, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { cn, currency, formatDate, number, todayISO } from '@/lib/utils';
import type { PurchaseOrder, PurchaseOrderStatus, PurchaseReturn } from '@/lib/types';
import {
  Button,
  Card,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { PaymentStatusBadge, PurchaseStatusBadge } from '@/components/ui/status';

/** Which action the vendor can take next, by current status. */
const NEXT_STATUS: Partial<Record<PurchaseOrderStatus, { status: PurchaseOrderStatus; label: string }>> = {
  ACCEPTED: { status: 'PROCESSING', label: 'Start processing' },
  PROCESSING: { status: 'READY_FOR_DELIVERY', label: 'Mark ready for delivery' },
  DISPATCHED: { status: 'DELIVERED', label: 'Mark delivered' },
};

export default function VendorOrdersPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'orders' | 'returns'>('orders');
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PurchaseOrder | null>(null);
  const [dispatching, setDispatching] = useState<PurchaseOrder | null>(null);

  const list = useListQuery<PurchaseOrder>('/vendor/orders', queryKeys.vendor.orders);

  const returns = useListQuery<PurchaseReturn>(
    '/vendor/orders/returns',
    queryKeys.vendor.purchaseReturns,
    { enabled: tab === 'returns' },
  );

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: queryKeys.vendor.order(openId ?? ''),
    queryFn: () => getOne<PurchaseOrder>(`/vendor/orders/${openId}`),
    enabled: Boolean(openId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.vendor.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
  };

  const accept = useMutation({
    mutationFn: (id: string) => post(`/vendor/orders/${id}/accept`, {}),
    onSuccess: () => {
      toast.success('Order accepted');
      invalidate();
    },
  });

  const reject = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      post(`/vendor/orders/${input.id}/reject`, { reason: input.reason }),
    onSuccess: () => {
      toast.success('Order rejected');
      setRejecting(null);
      invalidate();
    },
  });

  const advance = useMutation({
    mutationFn: (input: { id: string; status: PurchaseOrderStatus }) =>
      patch(`/vendor/orders/${input.id}/status`, { status: input.status }),
    onSuccess: () => {
      toast.success('Order status updated');
      invalidate();
    },
  });

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'po',
      header: 'Order',
      render: (order) => (
        <div>
          <p className="font-mono text-sm font-medium text-ink-900">{order.poNumber}</p>
          <p className="text-xs text-ink-500">{formatDate(order.createdAt, 'dd MMM yyyy, HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'retailer',
      header: 'Medical shop',
      render: (order) => (
        <div>
          <p className="text-sm font-medium text-ink-800">{order.retailer.storeName}</p>
          <p className="text-xs text-ink-500">{order._count?.items ?? order.items?.length ?? 0} line items</p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (order) => (
        <div>
          <p className="text-sm font-medium text-ink-900">{currency(order.totalAmount)}</p>
          <p className="text-xs text-ink-500">incl. {currency(order.taxAmount)} GST</p>
        </div>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      hideOnMobile: true,
      render: (order) => (
        <div className="space-y-1">
          <PaymentStatusBadge status={order.paymentStatus} />
          <p className="text-xs text-ink-500">{currency(order.paidAmount)} received</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <PurchaseStatusBadge status={order.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (order) => {
        const next = NEXT_STATUS[order.status];
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {order.status === 'PLACED' ? (
              <>
                <Button
                  size="sm"
                  icon={<Check className="h-3.5 w-3.5" />}
                  loading={accept.isPending}
                  onClick={() => accept.mutate(order.id)}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<X className="h-3.5 w-3.5" />}
                  onClick={() => setRejecting(order)}
                >
                  Reject
                </Button>
              </>
            ) : null}

            {order.status === 'READY_FOR_DELIVERY' ? (
              <Button
                size="sm"
                icon={<Truck className="h-3.5 w-3.5" />}
                onClick={() => setDispatching(order)}
              >
                Dispatch
              </Button>
            ) : null}

            {next ? (
              <Button
                size="sm"
                variant="outline"
                loading={advance.isPending}
                onClick={() => advance.mutate({ id: order.id, status: next.status })}
              >
                {next.label}
              </Button>
            ) : null}

            <Button variant="ghost" size="sm" onClick={() => setOpenId(order.id)}>
              View
            </Button>
          </div>
        );
      },
    },
  ];

  const returnColumns: Column<PurchaseReturn>[] = [
    {
      key: 'return',
      header: 'Return',
      render: (item) => (
        <div>
          <p className="font-mono text-sm font-medium text-ink-900">{item.returnNumber}</p>
          <p className="text-xs text-ink-500">{formatDate(item.returnDate)}</p>
        </div>
      ),
    },
    {
      key: 'retailer',
      header: 'Medical shop',
      render: (item) => <span className="text-sm text-ink-800">{item.retailer.storeName}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (item) => <span className="text-sm text-ink-700">{item.reason ?? '—'}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      hideOnMobile: true,
      render: (item) => (
        <span className="text-xs text-ink-500">
          {item.items.map((line) => `${line.productName ?? 'Product'} × ${number(line.quantity)}`).join(', ')}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      className: 'text-right',
      render: (item) => <span className="text-sm font-medium tabular-nums text-ink-900">{currency(item.totalAmount)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Retailer orders"
        description="Purchase orders from medical shops. Dispatching deducts your stock batch-wise and raises the invoice."
      />

      <div className="mb-4 flex gap-2">
        {(['orders', 'returns'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-brand-700 text-white'
                : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50',
            )}
          >
            {key === 'orders' ? 'Orders' : 'Returns'}
          </button>
        ))}
      </div>

      {tab === 'returns' ? (
        <DataTable
          columns={returnColumns}
          rows={returns.rows}
          rowKey={(item) => item.id}
          loading={returns.isLoading}
          error={returns.error}
          onRetry={() => void returns.refetch()}
          meta={returns.meta}
          onPageChange={returns.setPage}
          emptyTitle="No returns yet"
          emptyDescription="Returns a medical shop raises against a delivered order appear here."
        />
      ) : (
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
        emptyDescription="Once medical shops order from your catalogue, their orders appear here."
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by PO number or store"
              className="w-full sm:w-72"
            />
            <Select
              aria-label="Status"
              value={(list.filters.status as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('status', event.target.value)}
              className="w-48"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'PLACED', label: 'New orders' },
                { value: 'ACCEPTED', label: 'Accepted' },
                { value: 'PROCESSING', label: 'Processing' },
                { value: 'READY_FOR_DELIVERY', label: 'Ready for delivery' },
                { value: 'DISPATCHED', label: 'Dispatched' },
                { value: 'DELIVERED', label: 'Delivered' },
                { value: 'RECEIVED', label: 'Received' },
                { value: 'REJECTED', label: 'Rejected' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
          </FilterBar>
        }
      />
      )}

      {/* Order detail */}
      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={detail?.poNumber ?? 'Order'}
        description={detail ? `${detail.retailer.storeName} · ${formatDate(detail.createdAt)}` : undefined}
        size="lg"
      >
        {loadingDetail || !detail ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <PurchaseStatusBadge status={detail.status} />
              <PaymentStatusBadge status={detail.paymentStatus} />
            </div>

            <Card padded={false} className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-50">
                  <tr className="border-b border-ink-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-ink-500">Product</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Ordered</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Accepted</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id} className="border-b border-ink-100 last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink-800">{item.productName}</p>
                        {item.batchNumber ? (
                          <p className="font-mono text-xs text-ink-500">
                            Batch {item.batchNumber} · exp {formatDate(item.expiryDate, 'MMM yyyy')}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{number(item.quantity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {number(item.acceptedQty)}
                        {item.freeQty > 0 ? ` +${number(item.freeQty)} free` : ''}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
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
                <dt className="text-ink-500">GST</dt>
                <dd className="tabular-nums">{currency(detail.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{currency(detail.totalAmount)}</dd>
              </div>
              <div className="flex justify-between text-xs text-ink-500">
                <dt>Received</dt>
                <dd className="tabular-nums">{currency(detail.paidAmount)}</dd>
              </div>
            </dl>

            {detail.trackingNumber ? (
              <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-blue-800">
                Dispatched via {detail.courierName ?? 'courier'} · tracking {detail.trackingNumber}
              </p>
            ) : null}

            {detail.rejectionReason ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-red-800">
                {detail.rejectionReason}
              </p>
            ) : null}
          </div>
        )}
      </Modal>

      {/* Reject */}
      <RejectModal
        order={rejecting}
        loading={reject.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => rejecting && reject.mutate({ id: rejecting.id, reason })}
      />

      {/* Dispatch */}
      <DispatchModal
        order={dispatching}
        onClose={() => setDispatching(null)}
        onDone={() => {
          setDispatching(null);
          invalidate();
        }}
      />
    </>
  );
}

function RejectModal({
  order,
  loading,
  onClose,
  onSubmit,
}: {
  order: PurchaseOrder | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title="Reject order"
      description={order ? `${order.poNumber} from ${order.retailer.storeName}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => {
              if (reason.trim().length < 3) {
                toast.error('Give the retailer a reason');
                return;
              }
              onSubmit(reason.trim());
            }}
          >
            Reject order
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        required
        placeholder="Out of stock, minimum order not met, delivery area not served…"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </Modal>
  );
}

function DispatchModal({
  order,
  onClose,
  onDone,
}: {
  order: PurchaseOrder | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [batches, setBatches] = useState<Record<string, { batchNumber: string; expiryDate: string }>>({});

  const { data: detail, isLoading } = useQuery({
    queryKey: queryKeys.vendor.order(order?.id ?? ''),
    queryFn: () => getOne<PurchaseOrder>(`/vendor/orders/${order!.id}`),
    enabled: Boolean(order),
  });

  const dispatch = useMutation({
    mutationFn: () =>
      post(`/vendor/orders/${order!.id}/dispatch`, {
        courierName: courierName || undefined,
        trackingNumber: trackingNumber || undefined,
        items: (detail?.items ?? [])
          .filter((item) => item.acceptedQty + item.freeQty > 0)
          .map((item) => ({
            itemId: item.id,
            batchNumber: batches[item.id]?.batchNumber ?? '',
            expiryDate: batches[item.id]?.expiryDate ?? '',
          })),
      }),
    onSuccess: () => {
      toast.success('Order dispatched — stock deducted and invoice generated');
      onDone();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Dispatch failed');
    },
  });

  const shippable = (detail?.items ?? []).filter((item) => item.acceptedQty + item.freeQty > 0);
  const ready = shippable.every(
    (item) => batches[item.id]?.batchNumber && batches[item.id]?.expiryDate,
  );

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title="Dispatch order"
      description="Record the batch and expiry you are shipping — this deducts your stock first-expiry-first-out."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={<PackageCheck className="h-4 w-4" />}
            loading={dispatch.isPending}
            disabled={!ready}
            onClick={() => dispatch.mutate()}
          >
            Dispatch & invoice
          </Button>
        </>
      }
    >
      {isLoading || !detail ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Courier"
              placeholder="BlueDart"
              value={courierName}
              onChange={(event) => setCourierName(event.target.value)}
            />
            <Input
              label="Tracking number"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
            />
          </div>

          <div className="space-y-3">
            {shippable.map((item) => (
              <div key={item.id} className="rounded-lg border border-ink-200 p-3">
                <p className="text-sm font-medium text-ink-900">{item.productName}</p>
                <p className="mb-3 text-xs text-ink-500">
                  Shipping {number(item.acceptedQty)} unit(s)
                  {item.freeQty > 0 ? ` + ${number(item.freeQty)} free` : ''}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Batch number"
                    required
                    value={batches[item.id]?.batchNumber ?? ''}
                    onChange={(event) =>
                      setBatches((current) => ({
                        ...current,
                        [item.id]: { ...current[item.id], batchNumber: event.target.value },
                      }))
                    }
                  />
                  <Input
                    label="Expiry date"
                    type="date"
                    required
                    min={todayISO(1)}
                    value={batches[item.id]?.expiryDate ?? ''}
                    onChange={(event) =>
                      setBatches((current) => ({
                        ...current,
                        [item.id]: { ...current[item.id], expiryDate: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {!ready ? (
            <p className="text-sm text-warning">
              Enter a batch number and expiry for every line before dispatching.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
