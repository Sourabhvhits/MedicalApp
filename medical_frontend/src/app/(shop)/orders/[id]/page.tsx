'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Clock, FileText, MapPin, Phone, Printer, Repeat, Star } from 'lucide-react';
import { ApiError, getList, getOne, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { currency, formatDate, formatDateTime, humanize } from '@/lib/utils';
import type { Dispute, Order } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  LoadingBlock,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/status';
import { InvoiceDocument, type InvoiceDocumentData } from '@/components/invoice-document';

const CANCELLABLE = ['PENDING', 'ACCEPTED', 'PREPARING'];

export default function CustomerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [cartConflict, setCartConflict] = useState<string | null>(null);

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.customer.order(params.id),
    queryFn: () => getOne<Order>(`/customers/orders/${params.id}`),
    // Live-ish updates while an order is still being handled by the store.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && CANCELLABLE.concat('READY_FOR_PICKUP', 'OUT_FOR_DELIVERY').includes(status) ? 30_000 : false;
    },
  });

  const cancel = useMutation({
    mutationFn: () => post(`/customers/orders/${params.id}/cancel`, { reason }),
    onSuccess: () => {
      toast.success('Order cancelled — your reserved stock has been released');
      setCancelOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.all });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not cancel the order');
    },
  });

  const { data: invoice, isLoading: loadingInvoice } = useQuery({
    queryKey: [...queryKeys.customer.order(params.id), 'invoice'],
    queryFn: () => getOne<InvoiceDocumentData>(`/customers/orders/${params.id}/invoice`),
    enabled: invoiceOpen,
  });

  const reorder = useMutation({
    mutationFn: (replaceCart: boolean) =>
      post<{ dropped: { productName: string; reason: string }[] }>(`/customers/orders/${params.id}/reorder`, {
        replaceCart,
      }),
    onSuccess: (result) => {
      setCartConflict(null);
      if (result.dropped.length > 0) {
        toast.warning(
          `Added to cart — couldn't reorder: ${result.dropped.map((d) => d.productName).join(', ')}`,
        );
      } else {
        toast.success('Added to cart');
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.cart });
      router.push('/cart');
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'CART_STORE_CONFLICT') {
        setCartConflict(error.message);
        return;
      }
      toast.error(error instanceof ApiError ? error.message : 'Could not reorder');
    },
  });

  // At most one dispute is ever open on an order (the backend refuses a
  // second while one is OPEN/UNDER_REVIEW), so the latest one by orderNumber
  // is enough to know whether to show "Raise an issue" or its outcome.
  const { data: disputes } = useQuery({
    queryKey: queryKeys.customer.orderDispute(order?.orderNumber ?? ''),
    queryFn: () => getList<Dispute>('/customers/disputes', { search: order!.orderNumber, limit: 1 }),
    enabled: Boolean(order && order.status === 'COMPLETED'),
  });
  const dispute = disputes?.data[0];

  const raiseDispute = useMutation({
    mutationFn: () => post(`/customers/disputes/orders/${params.id}`, { reason: disputeReason }),
    onSuccess: () => {
      toast.success('Issue raised — the store has been notified');
      setDisputeOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.orderDispute(order!.orderNumber) });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not raise the issue');
    },
  });

  const review = useMutation({
    mutationFn: () =>
      post('/customers/reviews', {
        retailerId: order!.retailer.id,
        orderId: order!.id,
        rating: Number(rating),
        comment: comment || undefined,
      }),
    onSuccess: () => {
      toast.success('Thanks for your review');
      setReviewOpen(false);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not save your review');
    },
  });

  if (isLoading) return <LoadingBlock />;
  if (error || !order) {
    return <ErrorState message={(error as Error)?.message ?? 'Order not found'} onRetry={() => void refetch()} />;
  }

  return (
    <>
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All orders
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-lg font-semibold text-ink-900">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-ink-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </header>

      {order.status === 'READY_FOR_PICKUP' ? (
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <p className="font-semibold">Your order is ready to collect.</p>
          <p className="mt-1">
            Visit {order.retailer.storeName} between {order.pickupStart} and {order.pickupEnd} on{' '}
            {formatDate(order.pickupDate)}. Carry your prescription if this order needs one.
          </p>
        </div>
      ) : null}

      {order.status === 'OUT_FOR_DELIVERY' ? (
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <p className="font-semibold">Your order is out for delivery.</p>
          <p className="mt-1">
            {order.deliveryPartnerName ? `On its way via ${order.deliveryPartnerName}. ` : ''}
            {order.deliveryTrackingNumber ? `Tracking: ${order.deliveryTrackingNumber}.` : ''}
          </p>
        </div>
      ) : null}

      {order.status === 'DELIVERED' ? (
        <div className="mb-5 rounded-xl border border-success bg-success-soft px-4 py-3 text-sm text-green-800">
          <p className="font-semibold">Your order has been delivered.</p>
        </div>
      ) : null}

      {order.rejectionReason || order.cancellationReason ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-danger-soft px-4 py-3 text-sm text-red-800">
          {order.rejectionReason ?? order.cancellationReason}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Items</h2>
            <ul className="divide-y divide-ink-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{item.productName}</p>
                    <p className="text-xs text-ink-500">
                      {item.packSize} · {currency(item.unitPrice)} each
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-ink-700">× {item.quantity}</p>
                    <p className="text-sm font-medium tabular-nums text-ink-900">
                      {currency(item.totalAmount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Taxable value</dt>
                <dd className="tabular-nums">{currency(order.taxableAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">CGST + SGST</dt>
                <dd className="tabular-nums">{currency(order.taxAmount)}</dd>
              </div>
              {Number(order.deliveryChargeAmount) > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Delivery charge</dt>
                  <dd className="tabular-nums">{currency(order.deliveryChargeAmount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{currency(order.totalAmount)}</dd>
              </div>
            </dl>
          </Card>

          {order.statusHistory && order.statusHistory.length > 0 ? (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink-900">Progress</h2>
              <ol className="space-y-3">
                {order.statusHistory.map((entry, index) => (
                  <li key={entry.id} className="flex gap-3">
                    <span className="relative flex flex-col items-center">
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-600" />
                      {index < order.statusHistory!.length - 1 ? (
                        <span className="mt-1 w-px flex-1 bg-ink-200" />
                      ) : null}
                    </span>
                    <span className="pb-1">
                      <span className="block text-sm font-medium text-ink-800">
                        {humanize(entry.toStatus)}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {formatDateTime(entry.createdAt)}
                      </span>
                      {entry.notes ? (
                        <span className="block text-xs text-ink-500">{entry.notes}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4 lg:col-span-1">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">
              {order.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Pickup'}
            </h2>
            {order.fulfillmentType === 'DELIVERY' ? (
              <>
                <p className="inline-flex items-start gap-1.5 text-sm font-medium text-ink-800">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                  <span>
                    {[order.deliveryAddressLine1, order.deliveryLandmark, order.deliveryCity, order.deliveryPincode]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </p>
                {order.deliveryContactPhone ? (
                  <p className="mt-1 text-sm text-ink-600">{order.deliveryContactPhone}</p>
                ) : null}
                {order.deliveryPartnerName || order.deliveryTrackingNumber ? (
                  <p className="mt-1 text-xs text-ink-500">
                    {order.deliveryPartnerName ? `Via ${order.deliveryPartnerName}` : ''}
                    {order.deliveryTrackingNumber ? ` · Tracking ${order.deliveryTrackingNumber}` : ''}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-800">
                <Clock className="h-4 w-4 text-brand-700" />
                {formatDate(order.pickupDate, 'EEE dd MMM')} · {order.pickupStart} – {order.pickupEnd}
              </p>
            )}

            <h3 className="mt-4 text-sm font-semibold text-ink-900">
              <Link href={`/stores/${order.retailer.id}`} className="hover:text-brand-700">
                {order.retailer.storeName}
              </Link>
            </h3>
            <p className="mt-1 inline-flex items-start gap-1.5 text-sm text-ink-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              {[order.retailer.addressLine1, order.retailer.city].filter(Boolean).join(', ')}
            </p>
            <a
              href={`tel:${order.retailer.phone}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
            >
              <Phone className="h-4 w-4" />
              {order.retailer.phone}
            </a>

            <p className="mt-4 text-xs text-ink-500">
              Payment: {humanize(order.paymentMode)}
              {order.fulfillmentType === 'PICKUP' ? ' at the store' : order.paymentMode === 'COD' ? ' on delivery' : ''}
            </p>

            {order.prescriptionUrl ? (
              <a href={order.prescriptionUrl} target="_blank" rel="noreferrer" className="mt-3 block">
                <Badge tone="info">View uploaded prescription</Badge>
              </a>
            ) : null}
          </Card>

          {CANCELLABLE.includes(order.status) ? (
            <Button variant="outline" className="w-full" onClick={() => setCancelOpen(true)}>
              Cancel order
            </Button>
          ) : null}

          <Button
            variant="outline"
            className="w-full"
            icon={<Repeat className="h-4 w-4" />}
            loading={reorder.isPending}
            onClick={() => reorder.mutate(false)}
          >
            Order again
          </Button>

          {order.status === 'COMPLETED' ? (
            <Button
              variant="outline"
              className="w-full"
              icon={<FileText className="h-4 w-4" />}
              onClick={() => setInvoiceOpen(true)}
            >
              Download invoice
            </Button>
          ) : null}

          {order.status === 'COMPLETED' ? (
            <Button
              variant="outline"
              className="w-full"
              icon={<Star className="h-4 w-4" />}
              onClick={() => setReviewOpen(true)}
            >
              Rate this store
            </Button>
          ) : null}

          {order.status === 'COMPLETED' && dispute ? (
            <Card>
              <h2 className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Your reported issue
              </h2>
              <Badge
                tone={
                  dispute.status === 'RESOLVED'
                    ? 'success'
                    : dispute.status === 'REJECTED'
                      ? 'danger'
                      : 'warning'
                }
              >
                {humanize(dispute.status)}
              </Badge>
              <p className="mt-2 text-sm text-ink-700">{dispute.reason}</p>
              {dispute.resolution ? (
                <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                  <span className="font-medium">Store&apos;s response:</span> {dispute.resolution}
                </p>
              ) : null}
            </Card>
          ) : order.status === 'COMPLETED' ? (
            <Button
              variant="outline"
              className="w-full"
              icon={<AlertTriangle className="h-4 w-4" />}
              onClick={() => setDisputeOpen(true)}
            >
              Raise an issue
            </Button>
          ) : null}
        </aside>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this order?"
        description="The store will be notified and the reserved medicines go back on sale."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => {
                if (reason.trim().length < 3) {
                  toast.error('Tell the store why you are cancelling');
                  return;
                }
                cancel.mutate();
              }}
            >
              Cancel order
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          required
          placeholder="Changed my mind, found it elsewhere, cannot collect in time…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>

      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={`Rate ${order.retailer.storeName}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button loading={review.isPending} onClick={() => review.mutate()}>
              Submit review
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Rating"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            options={[
              { value: '5', label: '5 — Excellent' },
              { value: '4', label: '4 — Good' },
              { value: '3', label: '3 — Okay' },
              { value: '2', label: '2 — Poor' },
              { value: '1', label: '1 — Bad' },
            ]}
          />
          <Textarea
            label="Comment"
            placeholder="How was the service, stock availability and pickup experience?"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        title="Raise an issue"
        description={`${order.orderNumber} — the store is notified and staff can review this.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={raiseDispute.isPending}
              onClick={() => {
                if (disputeReason.trim().length < 10) {
                  toast.error('Explain the issue in a bit more detail');
                  return;
                }
                raiseDispute.mutate();
              }}
            >
              Raise issue
            </Button>
          </>
        }
      >
        <Textarea
          label="What went wrong?"
          required
          placeholder="Wrong item, missing item, damaged medicine, billing mismatch…"
          value={disputeReason}
          onChange={(event) => setDisputeReason(event.target.value)}
        />
      </Modal>

      <Modal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        title={invoice?.invoiceNumber ?? 'Invoice'}
        size="lg"
        footer={
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} className="no-print">
            Print
          </Button>
        }
      >
        {loadingInvoice || !invoice ? <LoadingBlock /> : <InvoiceDocument invoice={invoice} />}
      </Modal>

      <ConfirmDialog
        open={Boolean(cartConflict)}
        onClose={() => setCartConflict(null)}
        onConfirm={() => reorder.mutate(true)}
        loading={reorder.isPending}
        title="Start a new cart?"
        message={cartConflict ?? ''}
        confirmLabel="Replace cart"
        tone="danger"
      />
    </>
  );
}
