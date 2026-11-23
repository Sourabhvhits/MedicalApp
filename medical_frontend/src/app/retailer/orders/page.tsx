'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Clock, PackageCheck, RotateCcw, ShoppingBag, Truck, X } from 'lucide-react';
import { ApiError, getOne, patch, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { cn, currency, formatDate, humanize, number } from '@/lib/utils';
import type { Order, OrderStatus } from '@/lib/types';
import { Badge, Button, Card, Input, LoadingBlock, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/status';
import { ReasonModal } from '@/components/reason-modal';

/**
 * The single next step for each status, so staff never have to think.
 * PREPARING forks by fulfillment type — a pickup order goes to
 * READY_FOR_PICKUP, a delivery order to OUT_FOR_DELIVERY (which opens a
 * small courier-details modal rather than firing immediately, unlike every
 * other one-click step here).
 */
function nextActionFor(
  order: Order,
): { status: OrderStatus; label: string; icon: React.ReactNode; needsCourierModal?: boolean } | null {
  if (order.status === 'PENDING') return { status: 'ACCEPTED', label: 'Accept', icon: <Check className="h-3.5 w-3.5" /> };
  if (order.status === 'ACCEPTED') return { status: 'PREPARING', label: 'Start preparing', icon: <Clock className="h-3.5 w-3.5" /> };
  if (order.status === 'PREPARING') {
    return order.fulfillmentType === 'DELIVERY'
      ? { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery', icon: <Truck className="h-3.5 w-3.5" />, needsCourierModal: true }
      : { status: 'READY_FOR_PICKUP', label: 'Mark ready', icon: <PackageCheck className="h-3.5 w-3.5" /> };
  }
  if (order.status === 'READY_FOR_PICKUP') {
    return { status: 'PICKED_UP', label: 'Hand over', icon: <ShoppingBag className="h-3.5 w-3.5" /> };
  }
  if (order.status === 'OUT_FOR_DELIVERY') {
    return { status: 'DELIVERED', label: 'Mark delivered', icon: <Check className="h-3.5 w-3.5" /> };
  }
  if (order.status === 'PICKED_UP' || order.status === 'DELIVERED') {
    return { status: 'COMPLETED', label: 'Complete', icon: <Check className="h-3.5 w-3.5" /> };
  }
  return null;
}

export default function RetailerOrdersPage() {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [rejectingPrescription, setRejectingPrescription] = useState<Order | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);
  const [markingOutForDelivery, setMarkingOutForDelivery] = useState<Order | null>(null);
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const list = useListQuery<Order>('/retailer/orders', queryKeys.retailer.orders);

  const { data: board } = useQuery({
    queryKey: [...queryKeys.retailer.all, 'order-board'],
    queryFn: () => getOne<{ status: OrderStatus; count: number; amount: string }[]>('/retailer/orders/board'),
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: queryKeys.retailer.order(openId ?? ''),
    queryFn: () => getOne<Order>(`/retailer/orders/${openId}`),
    enabled: Boolean(openId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
  };

  const changeStatus = useMutation({
    mutationFn: (input: {
      id: string;
      status: OrderStatus;
      reason?: string;
      deliveryPartnerName?: string;
      deliveryTrackingNumber?: string;
    }) =>
      patch(`/retailer/orders/${input.id}/status`, {
        status: input.status,
        reason: input.reason,
        deliveryPartnerName: input.deliveryPartnerName || undefined,
        deliveryTrackingNumber: input.deliveryTrackingNumber || undefined,
      }),
    onSuccess: (_data, variables) => {
      toast.success(`Order marked ${humanize(variables.status).toLowerCase()}`);
      setRejecting(null);
      setMarkingOutForDelivery(null);
      setCourierName('');
      setTrackingNumber('');
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the order');
    },
  });

  const reviewPrescription = useMutation({
    mutationFn: (input: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      patch(`/retailer/orders/${input.id}/prescription`, { status: input.status, reason: input.reason }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === 'APPROVED' ? 'Prescription approved' : 'Prescription rejected',
      );
      setRejectingPrescription(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.order(variables.id) });
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the prescription');
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
      key: 'customer',
      header: 'Customer',
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
      render: (order) =>
        order.fulfillmentType === 'DELIVERY' ? (
          <div className="text-xs">
            <Badge tone="brand">Delivery</Badge>
            <p className="mt-0.5 truncate text-ink-500">{order.deliveryAddressLine1}</p>
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
      key: 'items',
      header: 'Items',
      hideOnMobile: true,
      render: (order) => (
        <span className="text-sm text-ink-700">{order._count?.items ?? order.items?.length ?? 0}</span>
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
      render: (order) => {
        const next = nextActionFor(order);
        const needsRxReview = order.status === 'PENDING' && order.prescriptionStatus === 'PENDING';
        return (
          <div className="flex flex-wrap justify-end gap-1">
            {needsRxReview ? (
              <Button size="sm" variant="outline" onClick={() => setOpenId(order.id)}>
                Review Rx
              </Button>
            ) : next ? (
              <Button
                size="sm"
                icon={next.icon}
                loading={changeStatus.isPending}
                onClick={() =>
                  next.needsCourierModal
                    ? setMarkingOutForDelivery(order)
                    : changeStatus.mutate({ id: order.id, status: next.status })
                }
              >
                {next.label}
              </Button>
            ) : null}
            {order.status === 'PENDING' ? (
              <Button
                size="sm"
                variant="outline"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => setRejecting(order)}
              >
                Reject
              </Button>
            ) : null}
            {order.status === 'COMPLETED' && order.paymentStatus !== 'REFUNDED' ? (
              <Button
                size="sm"
                variant="outline"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => setRefunding(order)}
              >
                Issue refund
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

  return (
    <>
      <PageHeader
        title="Customer orders"
        description="Stock is already reserved for every order here. Handing over deducts it and records the sale."
      />

      {board && board.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {board.map((row) => (
            <button
              key={row.status}
              type="button"
              onClick={() => list.setFilter('status', row.status)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                list.filters.status === row.status
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-ink-200 bg-white hover:border-ink-300',
              )}
            >
              <span className="block text-xs text-ink-500">{humanize(row.status)}</span>
              <span className="block text-lg font-semibold text-ink-900">{number(row.count)}</span>
              <span className="block text-xs text-ink-500">{currency(row.amount)}</span>
            </button>
          ))}
        </div>
      ) : null}

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
        emptyDescription="Orders placed by customers on the marketplace will appear here."
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by order number"
              className="w-full sm:w-64"
            />
            <Select
              aria-label="Status"
              value={(list.filters.status as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('status', event.target.value)}
              className="w-48"
              options={[
                { value: 'ALL', label: 'All orders' },
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
            <Select
              aria-label="Pickup day"
              value={(list.filters.pickupDate as string) ?? ''}
              onChange={(event) => list.setFilter('pickupDate', event.target.value)}
              className="w-44"
              options={[{ value: '', label: 'Any pickup date' }]}
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
            ? `${detail.customer?.user.firstName ?? ''} · ${
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
              ) : detail.prescriptionStatus === 'REJECTED' ? (
                <Badge tone="danger">Prescription rejected</Badge>
              ) : null}
            </div>

            {detail.fulfillmentType === 'DELIVERY' ? (
              <div className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-ink-800">
                  <Truck className="h-3.5 w-3.5 text-brand-700" />
                  Deliver to
                </p>
                <p className="text-ink-700">
                  {[detail.deliveryAddressLine1, detail.deliveryLandmark, detail.deliveryCity, detail.deliveryPincode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {detail.deliveryContactPhone ? (
                  <p className="text-ink-500">{detail.deliveryContactPhone}</p>
                ) : null}
                {detail.deliveryPartnerName || detail.deliveryTrackingNumber ? (
                  <p className="mt-1.5 text-xs text-ink-500">
                    {detail.deliveryPartnerName ? `Via ${detail.deliveryPartnerName}` : ''}
                    {detail.deliveryTrackingNumber ? ` · Tracking ${detail.deliveryTrackingNumber}` : ''}
                  </p>
                ) : null}
                {Number(detail.deliveryChargeAmount) > 0 ? (
                  <p className="mt-1.5 text-xs text-ink-500">
                    Delivery charge: {currency(detail.deliveryChargeAmount)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {detail.prescriptionStatus === 'PENDING' ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-warning-soft px-3 py-2.5">
                <p className="mr-auto text-sm text-amber-900">
                  This order cannot be accepted until the prescription is reviewed.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectingPrescription(detail)}
                  loading={reviewPrescription.isPending}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  loading={reviewPrescription.isPending}
                  onClick={() =>
                    reviewPrescription.mutate({ id: detail.id, status: 'APPROVED' })
                  }
                >
                  Approve prescription
                </Button>
              </div>
            ) : null}

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
                        {item.allocations && item.allocations.length > 0 ? (
                          <p className="mt-0.5 font-mono text-[11px] text-brand-700">
                            Pick:{' '}
                            {item.allocations
                              .map(
                                (allocation) =>
                                  `${allocation.batch.batchNumber} ×${allocation.quantity}`,
                              )
                              .join(', ')}
                          </p>
                        ) : null}
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

            {detail.salesReturns && detail.salesReturns.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Refunds</h3>
                <ul className="space-y-1">
                  {detail.salesReturns.map((refund) => (
                    <li key={refund.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink-700">
                        {refund.returnNumber} · {refund.reason ?? 'No reason given'}
                      </span>
                      <span className="font-medium tabular-nums text-ink-900">{currency(refund.totalAmount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {detail.status === 'COMPLETED' && detail.paymentStatus !== 'REFUNDED' ? (
              <Button
                size="sm"
                variant="outline"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => setRefunding(detail)}
              >
                Issue refund
              </Button>
            ) : null}

            {detail.statusHistory && detail.statusHistory.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Timeline
                </h3>
                <ol className="space-y-2">
                  {detail.statusHistory.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                      <span>
                        <span className="font-medium text-ink-800">{humanize(entry.toStatus)}</span>
                        <span className="ml-2 text-xs text-ink-500">
                          {formatDate(entry.createdAt, 'dd MMM, HH:mm')}
                        </span>
                        {entry.notes ? (
                          <span className="block text-xs text-ink-500">{entry.notes}</span>
                        ) : null}
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
        subject={rejecting}
        title="Reject order"
        description={(order) => `${order.orderNumber} — reserved stock will be released back to your shelf.`}
        confirmLabel="Reject order"
        placeholder="Out of stock, prescription not valid, cannot fulfil by the pickup time…"
        loading={changeStatus.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) =>
          rejecting && changeStatus.mutate({ id: rejecting.id, status: 'REJECTED', reason })
        }
      />

      <ReasonModal
        subject={rejectingPrescription}
        title="Reject prescription"
        description={(order) => `${order.orderNumber} — the customer is notified with your reason.`}
        confirmLabel="Reject prescription"
        placeholder="Illegible, expired, doesn't match the items ordered…"
        loading={reviewPrescription.isPending}
        onClose={() => setRejectingPrescription(null)}
        onSubmit={(reason) =>
          rejectingPrescription &&
          reviewPrescription.mutate({ id: rejectingPrescription.id, status: 'REJECTED', reason })
        }
      />

      <RefundModal
        order={refunding}
        onClose={() => setRefunding(null)}
        onDone={() => {
          setRefunding(null);
          invalidate();
        }}
      />

      <Modal
        open={Boolean(markingOutForDelivery)}
        onClose={() => {
          setMarkingOutForDelivery(null);
          setCourierName('');
          setTrackingNumber('');
        }}
        title="Mark out for delivery"
        description={markingOutForDelivery ? `${markingOutForDelivery.orderNumber} — courier details are optional.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setMarkingOutForDelivery(null)}>
              Cancel
            </Button>
            <Button
              loading={changeStatus.isPending}
              onClick={() =>
                markingOutForDelivery &&
                changeStatus.mutate({
                  id: markingOutForDelivery.id,
                  status: 'OUT_FOR_DELIVERY',
                  deliveryPartnerName: courierName,
                  deliveryTrackingNumber: trackingNumber,
                })
              }
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Delivery partner / rider (optional)"
            placeholder="Self, Dunzo, Porter…"
            value={courierName}
            onChange={(event) => setCourierName(event.target.value)}
          />
          <Input
            label="Tracking number (optional)"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}

function RefundModal({
  order,
  onClose,
  onDone,
}: {
  order: Order | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const { data: detail, isLoading } = useQuery({
    queryKey: queryKeys.retailer.order(order?.id ?? ''),
    queryFn: () => getOne<Order>(`/retailer/orders/${order!.id}`),
    enabled: Boolean(order),
  });

  const alreadyRefundedByProduct = new Map<string, number>();
  for (const refund of detail?.salesReturns ?? []) {
    for (const line of refund.items) {
      alreadyRefundedByProduct.set(
        line.productId,
        (alreadyRefundedByProduct.get(line.productId) ?? 0) + line.quantity,
      );
    }
  }

  const lines = (detail?.items ?? []).map((item) => ({
    item,
    remaining: item.quantity - (alreadyRefundedByProduct.get(item.productId) ?? 0),
  })).filter((line) => line.remaining > 0);

  const submit = useMutation({
    mutationFn: () =>
      post(`/retailer/orders/${order!.id}/refund`, {
        reason,
        items: lines
          .filter((line) => Number(quantities[line.item.id] ?? 0) > 0)
          .map((line) => ({ orderItemId: line.item.id, quantity: Number(quantities[line.item.id]) })),
      }),
    onSuccess: () => {
      toast.success('Refund issued');
      setReason('');
      setQuantities({});
      onDone();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not issue this refund');
    },
  });

  const hasAnyQuantity = lines.some((line) => Number(quantities[line.item.id] ?? 0) > 0);
  const ready = hasAnyQuantity && reason.trim().length >= 3;

  return (
    <Modal
      open={Boolean(order)}
      onClose={() => {
        setReason('');
        setQuantities({});
        onClose();
      }}
      title="Issue a refund"
      description="Full or partial — this records a refund transaction against your finance ledger."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submit.isPending} disabled={!ready} onClick={() => submit.mutate()}>
            Issue refund
          </Button>
        </>
      }
    >
      {isLoading || !detail ? (
        <LoadingBlock />
      ) : lines.length === 0 ? (
        <p className="text-sm text-ink-500">Every item on this order has already been fully refunded.</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {lines.map(({ item, remaining }) => (
              <div key={item.id} className="rounded-lg border border-ink-200 p-3">
                <p className="text-sm font-medium text-ink-900">{item.productName}</p>
                <p className="mb-3 text-xs text-ink-500">
                  {number(remaining)} of {number(item.quantity)} refundable · rate {currency(item.unitPrice)}
                </p>
                <Input
                  label="Quantity to refund"
                  type="number"
                  min={0}
                  max={remaining}
                  value={quantities[item.id] ?? ''}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <Textarea
            label="Reason"
            required
            placeholder="Customer returned unopened medicine, billing error…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
