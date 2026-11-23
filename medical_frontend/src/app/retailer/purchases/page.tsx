'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Minus, PackageCheck, Plus, RotateCcw, ShoppingCart, Trash2, Wallet } from 'lucide-react';
import { ApiError, getOne, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { cn, currency, formatDate, number, todayISO } from '@/lib/utils';
import type { PurchaseOrder, PurchaseReturn, VendorProductListing } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { PaymentStatusBadge, PurchaseStatusBadge } from '@/components/ui/status';

interface DraftLine {
  vendorProductId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  minOrderQty: number;
  availableQty: number;
}

export default function RetailerPurchasesPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'orders' | 'browse' | 'returns'>('orders');
  const [vendorId, setVendorId] = useState<string>('');
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [paying, setPaying] = useState<PurchaseOrder | null>(null);
  const [returning, setReturning] = useState<PurchaseOrder | null>(null);

  const orders = useListQuery<PurchaseOrder>('/retailer/purchases', queryKeys.retailer.purchases);

  const returns = useListQuery<PurchaseReturn>(
    '/retailer/purchases/returns',
    queryKeys.retailer.purchaseReturns,
    { enabled: tab === 'returns' },
  );

  const catalogue = useListQuery<VendorProductListing>(
    '/retailer/vendor-products',
    queryKeys.retailer.vendorProducts,
    { initialFilters: { inStockOnly: true }, enabled: tab === 'browse' },
  );

  const { data: vendors } = useQuery({
    queryKey: queryKeys.retailer.vendors({ limit: 100 }),
    queryFn: () =>
      getOne<{ id: string; businessName: string; city: string | null; minOrderValue: string }[]>(
        '/retailer/vendors',
        { limit: 100 },
      ).catch(() => []),
    enabled: tab === 'browse',
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: queryKeys.retailer.purchase(openId ?? ''),
    queryFn: () => getOne<PurchaseOrder>(`/retailer/purchases/${openId}`),
    enabled: Boolean(openId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
  };

  const placeOrder = useMutation({
    mutationFn: (input: { expectedDate?: string; notes?: string }) =>
      post('/retailer/purchases', {
        vendorId,
        expectedDate: input.expectedDate || undefined,
        notes: input.notes || undefined,
        items: draft.map((line) => ({
          vendorProductId: line.vendorProductId,
          quantity: line.quantity,
        })),
      }),
    onSuccess: () => {
      toast.success('Purchase order placed');
      setDraft([]);
      setCartOpen(false);
      setTab('orders');
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not place the order');
    },
  });

  const draftTotal = useMemo(
    () =>
      draft.reduce(
        (sum, line) => sum + line.unitPrice * line.quantity * (1 + line.gstRate / 100),
        0,
      ),
    [draft],
  );

  const addToDraft = (listing: VendorProductListing) => {
    // A purchase order belongs to one wholesaler, mirroring the API rule.
    if (vendorId && vendorId !== listing.vendorId) {
      toast.error(
        'Your draft order is with another wholesaler. Place or clear it before adding from a different vendor.',
      );
      return;
    }
    setVendorId(listing.vendorId);
    setDraft((current) => {
      const existing = current.find((line) => line.vendorProductId === listing.id);
      if (existing) {
        return current.map((line) =>
          line.vendorProductId === listing.id
            ? { ...line, quantity: line.quantity + listing.minOrderQty }
            : line,
        );
      }
      return [
        ...current,
        {
          vendorProductId: listing.id,
          productName: listing.product.name,
          quantity: listing.minOrderQty,
          unitPrice: Number(listing.sellingPrice),
          gstRate: Number(listing.gstRate),
          minOrderQty: listing.minOrderQty,
          availableQty: listing.availableQty,
        },
      ];
    });
    toast.success(`${listing.product.name} added to the draft order`);
  };

  const orderColumns: Column<PurchaseOrder>[] = [
    {
      key: 'po',
      header: 'Order',
      render: (order) => (
        <div>
          <p className="font-mono text-sm font-medium text-ink-900">{order.poNumber}</p>
          <p className="text-xs text-ink-500">{formatDate(order.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'vendor',
      header: 'Wholesaler',
      render: (order) => (
        <div>
          <p className="text-sm text-ink-800">{order.vendor.businessName}</p>
          <p className="text-xs text-ink-500">
            {order._count?.items ?? order.items?.length ?? 0} line items
          </p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (order) => (
        <div>
          <p className="text-sm font-medium text-ink-900">{currency(order.totalAmount)}</p>
          <p className="text-xs text-ink-500">
            {currency(Number(order.totalAmount) - Number(order.paidAmount))} outstanding
          </p>
        </div>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      hideOnMobile: true,
      render: (order) => <PaymentStatusBadge status={order.paymentStatus} />,
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
      render: (order) => (
        <div className="flex flex-wrap justify-end gap-1">
          {['DISPATCHED', 'DELIVERED'].includes(order.status) ? (
            <Button
              size="sm"
              icon={<PackageCheck className="h-3.5 w-3.5" />}
              onClick={() => setReceiving(order)}
            >
              Receive stock
            </Button>
          ) : null}
          {['RECEIVED', 'COMPLETED'].includes(order.status) ? (
            <Button
              size="sm"
              variant="outline"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => setReturning(order)}
            >
              Raise a return
            </Button>
          ) : null}
          {Number(order.paidAmount) < Number(order.totalAmount) &&
          !['CANCELLED', 'REJECTED'].includes(order.status) ? (
            <Button
              size="sm"
              variant="outline"
              icon={<Wallet className="h-3.5 w-3.5" />}
              onClick={() => setPaying(order)}
            >
              Pay
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setOpenId(order.id)}>
            View
          </Button>
        </div>
      ),
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
      key: 'vendor',
      header: 'Wholesaler',
      render: (item) => <span className="text-sm text-ink-800">{item.vendor.businessName}</span>,
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
        title="Purchases"
        description="Order stock from approved wholesalers. Receiving a delivery creates batch-wise stock in your store."
        action={
          draft.length > 0 ? (
            <Button icon={<ShoppingCart className="h-4 w-4" />} onClick={() => setCartOpen(true)}>
              Draft order ({draft.length}) · {currency(draftTotal)}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex gap-2">
        {(['orders', 'browse', 'returns'] as const).map((key) => (
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
            {key === 'orders' ? 'My purchase orders' : key === 'browse' ? 'Browse wholesalers' : 'Returns'}
          </button>
        ))}
      </div>

      {tab === 'orders' ? (
        <DataTable
          columns={orderColumns}
          rows={orders.rows}
          rowKey={(order) => order.id}
          loading={orders.isLoading}
          error={orders.error}
          onRetry={() => void orders.refetch()}
          meta={orders.meta}
          onPageChange={orders.setPage}
          emptyTitle="No purchase orders yet"
          emptyDescription="Browse wholesalers to place your first stock order."
          emptyAction={<Button onClick={() => setTab('browse')}>Browse wholesalers</Button>}
          toolbar={
            <FilterBar>
              <SearchInput
                value={orders.search}
                onChange={orders.setSearch}
                placeholder="Search by PO number or vendor"
                className="w-full sm:w-72"
              />
              <Select
                aria-label="Status"
                value={(orders.filters.status as string) ?? 'ALL'}
                onChange={(event) => orders.setFilter('status', event.target.value)}
                className="w-48"
                options={[
                  { value: 'ALL', label: 'All statuses' },
                  { value: 'PLACED', label: 'Placed' },
                  { value: 'ACCEPTED', label: 'Accepted' },
                  { value: 'PROCESSING', label: 'Processing' },
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
      ) : tab === 'returns' ? (
        <DataTable
          columns={returnColumns}
          rows={returns.rows}
          rowKey={(item) => item.id}
          loading={returns.isLoading}
          error={returns.error}
          onRetry={() => void returns.refetch()}
          meta={returns.meta}
          onPageChange={returns.setPage}
          emptyTitle="No returns raised yet"
          emptyDescription="Raise a return from a received purchase order if goods need to go back to the wholesaler."
        />
      ) : (
        <>
          {draft.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <p className="text-sm text-brand-900">
                Draft order with{' '}
                <span className="font-semibold">
                  {vendors?.find((vendor) => vendor.id === vendorId)?.businessName ?? 'this wholesaler'}
                </span>{' '}
                — {draft.length} product(s), about {currency(draftTotal)} incl. GST
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDraft([]); setVendorId(''); }}>
                  Clear
                </Button>
                <Button size="sm" onClick={() => setCartOpen(true)}>
                  Review & place
                </Button>
              </div>
            </div>
          ) : null}

          <DataTable
            columns={[
              {
                key: 'product',
                header: 'Product',
                render: (listing: VendorProductListing) => (
                  <div>
                    <p className="font-medium text-ink-900">{listing.product.name}</p>
                    <p className="text-xs text-ink-500">
                      {[listing.product.brandName, listing.product.packSize].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                ),
              },
              {
                key: 'vendor',
                header: 'Wholesaler',
                render: (listing: VendorProductListing) => (
                  <div>
                    <p className="text-sm text-ink-700">{listing.vendor.businessName}</p>
                    <p className="text-xs text-ink-500">
                      Min order {currency(listing.vendor.minOrderValue)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'price',
                header: 'Rate',
                render: (listing: VendorProductListing) => (
                  <div>
                    <p className="text-sm font-medium text-ink-900">{currency(listing.sellingPrice)}</p>
                    <p className="text-xs text-ink-500">
                      MRP {currency(listing.mrp)} · {Number(listing.gstRate)}% GST
                    </p>
                  </div>
                ),
              },
              {
                key: 'availability',
                header: 'Available',
                render: (listing: VendorProductListing) => (
                  <div>
                    <p className="text-sm text-ink-800">{number(listing.availableQty)}</p>
                    <p className="text-xs text-ink-500">MOQ {listing.minOrderQty}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                render: (listing: VendorProductListing) => (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => addToDraft(listing)}
                  >
                    Add
                  </Button>
                ),
              },
            ]}
            rows={catalogue.rows}
            rowKey={(listing) => listing.id}
            loading={catalogue.isLoading}
            error={catalogue.error}
            onRetry={() => void catalogue.refetch()}
            meta={catalogue.meta}
            onPageChange={catalogue.setPage}
            emptyTitle="No wholesale products found"
            emptyDescription="Try a different search, or check back when wholesalers add stock."
            toolbar={
              <FilterBar>
                <SearchInput
                  value={catalogue.search}
                  onChange={catalogue.setSearch}
                  placeholder="Search medicines to buy"
                  className="w-full sm:w-72"
                />
                <Select
                  aria-label="Wholesaler"
                  value={(catalogue.filters.vendorId as string) ?? 'ALL'}
                  onChange={(event) => catalogue.setFilter('vendorId', event.target.value)}
                  className="w-56"
                >
                  <option value="ALL">All wholesalers</option>
                  {vendors?.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.businessName}
                    </option>
                  ))}
                </Select>
              </FilterBar>
            }
          />
        </>
      )}

      {/* Draft order review */}
      <DraftOrderModal
        open={cartOpen}
        draft={draft}
        total={draftTotal}
        loading={placeOrder.isPending}
        onClose={() => setCartOpen(false)}
        onChangeQty={(id, quantity) =>
          setDraft((current) =>
            current.map((line) => (line.vendorProductId === id ? { ...line, quantity } : line)),
          )
        }
        onRemove={(id) => {
          setDraft((current) => {
            const next = current.filter((line) => line.vendorProductId !== id);
            if (next.length === 0) setVendorId('');
            return next;
          });
        }}
        onSubmit={(expectedDate, notes) => placeOrder.mutate({ expectedDate, notes })}
      />

      {/* Purchase order detail */}
      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={detail?.poNumber ?? 'Purchase order'}
        description={detail ? `${detail.vendor.businessName} · ${formatDate(detail.createdAt)}` : undefined}
        size="lg"
      >
        {loadingDetail || !detail ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <PurchaseStatusBadge status={detail.status} />
              <PaymentStatusBadge status={detail.paymentStatus} />
              {detail.trackingNumber ? (
                <Badge tone="info">
                  {detail.courierName} · {detail.trackingNumber}
                </Badge>
              ) : null}
            </div>

            <Card padded={false} className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-50">
                  <tr className="border-b border-ink-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-ink-500">Product</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Ordered</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Accepted</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-ink-500">Received</th>
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
                      <td className="px-3 py-2 text-right tabular-nums">{number(item.acceptedQty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{number(item.receivedQty)}</td>
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
                <dt className="text-ink-500">GST</dt>
                <dd className="tabular-nums">{currency(detail.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{currency(detail.totalAmount)}</dd>
              </div>
              <div className="flex justify-between text-xs text-ink-500">
                <dt>Paid</dt>
                <dd className="tabular-nums">{currency(detail.paidAmount)}</dd>
              </div>
            </dl>

            {detail.rejectionReason ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-red-800">
                {detail.rejectionReason}
              </p>
            ) : null}
          </div>
        )}
      </Modal>

      <ReceiveStockModal
        order={receiving}
        onClose={() => setReceiving(null)}
        onDone={() => {
          setReceiving(null);
          invalidate();
        }}
      />

      <PaymentModal
        order={paying}
        onClose={() => setPaying(null)}
        onDone={() => {
          setPaying(null);
          invalidate();
        }}
      />

      <ReturnModal
        order={returning}
        onClose={() => setReturning(null)}
        onDone={() => {
          setReturning(null);
          invalidate();
        }}
      />
    </>
  );
}

function DraftOrderModal({
  open,
  draft,
  total,
  loading,
  onClose,
  onChangeQty,
  onRemove,
  onSubmit,
}: {
  open: boolean;
  draft: DraftLine[];
  total: number;
  loading: boolean;
  onClose: () => void;
  onChangeQty: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onSubmit: (expectedDate: string, notes: string) => void;
}) {
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review purchase order"
      description="Quantities must meet each product's minimum order quantity."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Keep browsing
          </Button>
          <Button
            loading={loading}
            disabled={draft.length === 0}
            onClick={() => onSubmit(expectedDate, notes)}
          >
            Place order
          </Button>
        </>
      }
    >
      {draft.length === 0 ? (
        <EmptyState title="Your draft is empty" description="Add products from a wholesaler's catalogue." />
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-ink-100">
            {draft.map((line) => (
              <li key={line.vendorProductId} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{line.productName}</p>
                  <p className="text-xs text-ink-500">
                    {currency(line.unitPrice)} + {line.gstRate}% GST · MOQ {line.minOrderQty} ·{' '}
                    {number(line.availableQty)} available
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Decrease"
                    onClick={() =>
                      onChangeQty(
                        line.vendorProductId,
                        Math.max(line.minOrderQty, line.quantity - line.minOrderQty),
                      )
                    }
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <input
                    type="number"
                    value={line.quantity}
                    min={line.minOrderQty}
                    onChange={(event) =>
                      onChangeQty(line.vendorProductId, Math.max(1, Number(event.target.value)))
                    }
                    className="w-16 rounded-lg border border-ink-300 px-2 py-1.5 text-center text-sm tabular-nums"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Increase"
                    onClick={() =>
                      onChangeQty(line.vendorProductId, line.quantity + line.minOrderQty)
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <span className="w-24 text-right text-sm font-medium tabular-nums text-ink-900">
                  {currency(line.unitPrice * line.quantity * (1 + line.gstRate / 100))}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() => onRemove(line.vendorProductId)}
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex justify-end border-t border-ink-200 pt-3">
            <p className="text-base font-semibold text-ink-900">
              Estimated total {currency(total)}
              <span className="ml-2 text-xs font-normal text-ink-500">incl. GST</span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Expected delivery date"
              type="date"
              min={todayISO()}
              value={expectedDate}
              onChange={(event) => setExpectedDate(event.target.value)}
            />
            <Textarea
              label="Notes for the wholesaler"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

function ReceiveStockModal({
  order,
  onClose,
  onDone,
}: {
  order: PurchaseOrder | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<
    Record<string, { receivedQty: string; batchNumber: string; expiryDate: string; purchasePrice: string; mrp: string }>
  >({});

  const { data: detail, isLoading } = useQuery({
    queryKey: queryKeys.retailer.purchase(order?.id ?? ''),
    queryFn: () => getOne<PurchaseOrder>(`/retailer/purchases/${order!.id}`),
    enabled: Boolean(order),
  });

  const receive = useMutation({
    mutationFn: () =>
      post(`/retailer/purchases/${order!.id}/receive`, {
        items: (detail?.items ?? [])
          .filter((item) => item.acceptedQty + item.freeQty > 0)
          .map((item) => {
            const row = rows[item.id];
            return {
              itemId: item.id,
              receivedQty: Number(row?.receivedQty ?? item.acceptedQty),
              freeQty: item.freeQty,
              batchNumber: row?.batchNumber || item.batchNumber || '',
              expiryDate: row?.expiryDate || item.expiryDate || '',
              purchasePrice: Number(row?.purchasePrice ?? item.unitPrice),
              mrp: Number(row?.mrp ?? item.mrp),
              sellingPrice: Number(row?.mrp ?? item.mrp),
            };
          }),
      }),
    onSuccess: () => {
      toast.success('Stock received and added to your inventory');
      onDone();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not receive this delivery');
    },
  });

  const lines = (detail?.items ?? []).filter((item) => item.acceptedQty + item.freeQty > 0);
  const ready = lines.every((item) => {
    const row = rows[item.id];
    return (row?.batchNumber || item.batchNumber) && (row?.expiryDate || item.expiryDate);
  });

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title="Receive delivery"
      description="Confirm what physically arrived. This creates batch-wise stock and records the purchase in your books."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={<PackageCheck className="h-4 w-4" />}
            loading={receive.isPending}
            disabled={!ready}
            onClick={() => receive.mutate()}
          >
            Receive into stock
          </Button>
        </>
      }
    >
      {isLoading || !detail ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-3">
          {lines.map((item) => (
            <div key={item.id} className="rounded-lg border border-ink-200 p-3">
              <p className="text-sm font-medium text-ink-900">{item.productName}</p>
              <p className="mb-3 text-xs text-ink-500">
                Dispatched {number(item.acceptedQty)}
                {item.freeQty > 0 ? ` + ${number(item.freeQty)} free` : ''} · rate{' '}
                {currency(item.unitPrice)}
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label="Received qty"
                  type="number"
                  min={0}
                  max={item.acceptedQty}
                  value={rows[item.id]?.receivedQty ?? String(item.acceptedQty)}
                  onChange={(event) =>
                    setRows((current) => ({
                      ...current,
                      [item.id]: { ...current[item.id], receivedQty: event.target.value },
                    }))
                  }
                />
                <Input
                  label="Batch number"
                  required
                  value={rows[item.id]?.batchNumber ?? item.batchNumber ?? ''}
                  onChange={(event) =>
                    setRows((current) => ({
                      ...current,
                      [item.id]: { ...current[item.id], batchNumber: event.target.value },
                    }))
                  }
                />
                <Input
                  label="Expiry"
                  type="date"
                  required
                  min={todayISO(1)}
                  value={
                    rows[item.id]?.expiryDate ??
                    (item.expiryDate ? item.expiryDate.slice(0, 10) : '')
                  }
                  onChange={(event) =>
                    setRows((current) => ({
                      ...current,
                      [item.id]: { ...current[item.id], expiryDate: event.target.value },
                    }))
                  }
                />
                <Input
                  label="MRP"
                  type="number"
                  step="0.01"
                  value={rows[item.id]?.mrp ?? String(item.mrp)}
                  onChange={(event) =>
                    setRows((current) => ({
                      ...current,
                      [item.id]: { ...current[item.id], mrp: event.target.value },
                    }))
                  }
                />
              </div>
            </div>
          ))}

          {!ready ? (
            <p className="text-sm text-warning">
              Every line needs a batch number and expiry date before it can enter stock.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function ReturnModal({
  order,
  onClose,
  onDone,
}: {
  order: PurchaseOrder | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const { data: detail, isLoading } = useQuery({
    queryKey: queryKeys.retailer.purchase(order?.id ?? ''),
    queryFn: () => getOne<PurchaseOrder>(`/retailer/purchases/${order!.id}`),
    enabled: Boolean(order),
  });

  const lines = (detail?.items ?? []).filter((item) => item.receivedQty > 0);

  const submit = useMutation({
    mutationFn: () =>
      post('/retailer/purchases/returns', {
        purchaseOrderId: order!.id,
        vendorId: detail!.vendor.id,
        reason,
        items: lines
          .filter((item) => Number(quantities[item.id] ?? 0) > 0)
          .map((item) => ({
            productId: item.productId,
            batchNumber: item.batchNumber ?? undefined,
            quantity: Number(quantities[item.id]),
            unitPrice: Number(item.unitPrice),
            gstRate: Number(item.gstRate),
          })),
      }),
    onSuccess: () => {
      toast.success('Return recorded — stock has been deducted');
      setReason('');
      setQuantities({});
      onDone();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not raise this return');
    },
  });

  const hasAnyQuantity = lines.some((item) => Number(quantities[item.id] ?? 0) > 0);
  const ready = hasAnyQuantity && reason.trim().length >= 3;

  return (
    <Modal
      open={Boolean(order)}
      onClose={() => {
        setReason('');
        setQuantities({});
        onClose();
      }}
      title="Raise a return"
      description="Send received stock back to the wholesaler. This deducts the returned quantity from your stock immediately."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submit.isPending} disabled={!ready} onClick={() => submit.mutate()}>
            Raise return
          </Button>
        </>
      }
    >
      {isLoading || !detail ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {lines.map((item) => (
              <div key={item.id} className="rounded-lg border border-ink-200 p-3">
                <p className="text-sm font-medium text-ink-900">{item.productName}</p>
                <p className="mb-3 text-xs text-ink-500">
                  Received {number(item.receivedQty)}
                  {item.batchNumber ? ` · batch ${item.batchNumber}` : ''} · rate {currency(item.unitPrice)}
                </p>
                <Input
                  label="Quantity to return"
                  type="number"
                  min={0}
                  max={item.receivedQty}
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
            placeholder="Damaged in transit, wrong item shipped, near expiry…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}

function PaymentModal({
  order,
  onClose,
  onDone,
}: {
  order: PurchaseOrder | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('BANK_TRANSFER');
  const [referenceNo, setReferenceNo] = useState('');

  const outstanding = order ? Number(order.totalAmount) - Number(order.paidAmount) : 0;

  const pay = useMutation({
    mutationFn: () =>
      post(`/retailer/purchases/${order!.id}/payments`, {
        amount: Number(amount),
        mode,
        referenceNo: referenceNo || undefined,
      }),
    onSuccess: () => {
      toast.success('Payment recorded');
      setAmount('');
      setReferenceNo('');
      onDone();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not record the payment');
    },
  });

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title="Record payment"
      description={order ? `${order.poNumber} — ${currency(outstanding)} outstanding` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={pay.isPending}
            onClick={() => {
              if (!amount || Number(amount) <= 0) {
                toast.error('Enter the amount paid');
                return;
              }
              pay.mutate();
            }}
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          max={outstanding}
          required
          hint={`Cannot exceed ${currency(outstanding)}`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Select
          label="Mode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          options={[
            { value: 'BANK_TRANSFER', label: 'Bank transfer' },
            { value: 'UPI', label: 'UPI' },
            { value: 'CHEQUE', label: 'Cheque' },
            { value: 'CASH', label: 'Cash' },
            { value: 'CARD', label: 'Card' },
          ]}
        />
        <Input
          label="Reference number"
          placeholder="NEFT / UTR / cheque number"
          value={referenceNo}
          onChange={(event) => setReferenceNo(event.target.value)}
        />
        <Button variant="ghost" size="sm" onClick={() => setAmount(String(outstanding))}>
          Pay the full outstanding amount
        </Button>
      </div>
    </Modal>
  );
}
