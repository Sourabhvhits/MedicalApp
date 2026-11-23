'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CalendarX2, IndianRupee, Layers, Plus, SlidersHorizontal } from 'lucide-react';
import { ApiError, getList, getOne, patch, post, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { cn, currency, formatDate, humanize, number, todayISO } from '@/lib/utils';
import type { ExpirySummary, InventoryBatch, InventoryTransaction, Product, Warehouse } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonRows,
  Textarea,
} from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { ExpiryBadge } from '@/components/ui/status';
import { StatCard } from '@/components/charts';
import { BarcodeScanButton } from '@/components/barcode-scanner';

type Scope = 'vendor' | 'retailer';
type View = 'batches' | 'expiry' | 'low-stock' | 'transactions';

/** Matches the key `CatalogManager` writes when it hands off a just-added
 * product to pre-fill here (see TASKS.md #0). */
const PENDING_ADD_STOCK_KEY = 'medmarket:pendingAddStock';

const VIEWS: { key: View; label: string }[] = [
  { key: 'batches', label: 'Stock batches' },
  { key: 'expiry', label: 'Expiry' },
  { key: 'low-stock', label: 'Low stock' },
  { key: 'transactions', label: 'Movement log' },
];

interface LowStockRow {
  productId: string;
  name: string;
  sku: string;
  availableQty: number;
  minStockAlert: number;
}

interface ReorderSuggestion {
  productId: string;
  name: string;
  sku: string;
  availableQty: number;
  unitsSoldLast30Days: number;
  velocityPerDay: number;
  daysOfStockLeft: number | null;
}

interface Valuation {
  totalBatches: number;
  totalUnits: number;
  costValue: number;
  mrpValue: number;
  potentialMargin: number;
}

/**
 * Batch-level stock management for vendors and medical shops: add stock,
 * adjust a batch, write off damage or expiry, and read the movement ledger.
 */
export function InventoryWorkspace({ scope, basePath }: { scope: Scope; basePath: string }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('batches');
  const [adjusting, setAdjusting] = useState<InventoryBatch | null>(null);

  // Arriving here right after "Add product" on the catalogue page — open
  // straight into "Add stock" for that product instead of making the user
  // find this tab and search for it again. Read once via a lazy initializer
  // (not an effect) since it only matters for this page's very first render.
  const [pendingAddStockProduct, setPendingAddStockProduct] = useState<Product | null>(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_ADD_STOCK_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(PENDING_ADD_STOCK_KEY);
      const parsed = JSON.parse(raw) as { scope: Scope; product: Product };
      return parsed.scope === scope ? parsed.product : null;
    } catch {
      return null;
    }
  });
  const [addOpen, setAddOpen] = useState(() => pendingAddStockProduct !== null);

  const batches = useListQuery<InventoryBatch>(`${basePath}/batches`, (params) =>
    queryKeys.inventory.batches(scope, params),
  );
  const expiring = useListQuery<InventoryBatch>(`${basePath}/expiring`, (params) =>
    queryKeys.inventory.expiring(scope, params),
    { initialFilters: { days: 90 }, enabled: view === 'expiry' },
  );
  const transactions = useListQuery<InventoryTransaction>(`${basePath}/transactions`, (params) =>
    queryKeys.inventory.transactions(scope, params),
    { enabled: view === 'transactions' },
  );

  const { data: valuation } = useQuery({
    queryKey: queryKeys.inventory.valuation(scope),
    queryFn: () => getOne<Valuation>(`${basePath}/valuation`),
  });

  const { data: expirySummary } = useQuery({
    queryKey: queryKeys.inventory.expirySummary(scope),
    queryFn: () => getOne<ExpirySummary>(`${basePath}/expiry-summary`),
  });

  const { data: lowStock, isLoading: loadingLowStock } = useQuery({
    queryKey: queryKeys.inventory.lowStock(scope),
    queryFn: () => getOne<LowStockRow[]>(`${basePath}/low-stock`, { limit: 100 }),
    enabled: view === 'low-stock',
  });

  const { data: reorderSuggestions, isLoading: loadingReorder } = useQuery({
    queryKey: queryKeys.inventory.reorderSuggestions(scope),
    queryFn: () => getOne<ReorderSuggestion[]>(`${basePath}/reorder-suggestions`, { limit: 100 }),
    enabled: view === 'low-stock',
  });

  const { data: warehouses } = useQuery({
    queryKey: queryKeys.inventory.warehouses(scope),
    queryFn: () => getOne<Warehouse[]>(`${basePath}/warehouses`),
  });
  // Multiple warehouses are the exception, not the norm — only show a
  // location filter/picker once there's actually more than one to choose
  // between, so the common single-warehouse case sees no extra UI.
  const warehouseOptions = (warehouses ?? []).filter((warehouse) => warehouse.isActive);
  const showWarehousePicker = warehouseOptions.length > 1;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    void queryClient.invalidateQueries({
      queryKey: scope === 'vendor' ? queryKeys.vendor.all : queryKeys.retailer.all,
    });
  };

  const adjust = useMutation({
    mutationFn: (input: { id: string; quantity: number; reason: string }) =>
      patch(`${basePath}/batches/${input.id}/adjust`, {
        quantity: input.quantity,
        reason: input.reason,
      }),
    onSuccess: () => {
      toast.success('Stock adjusted — an inventory transaction was recorded');
      setAdjusting(null);
      invalidate();
    },
  });

  // Catalogue pricing lives under /products, not /inventory — same
  // `/retailer` or `/vendor` prefix, reusing the existing price-update
  // endpoint rather than adding a new one (TASKS.md #30).
  const catalogBasePath = basePath.replace('/inventory', '/products');
  const applyClearance = useMutation({
    mutationFn: (input: { catalogEntryId: string; discountPct: number; sellingPrice: number }) =>
      put(`${catalogBasePath}/${input.catalogEntryId}`, {
        discountPct: input.discountPct,
        sellingPrice: input.sellingPrice,
      }),
    onSuccess: () => {
      toast.success('Clearance discount applied');
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not apply the discount');
    },
  });

  const batchColumns: Column<InventoryBatch>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (batch) => (
        <div>
          <p className="font-medium text-ink-900">{batch.product.name}</p>
          <p className="text-xs text-ink-500">
            {batch.product.sku}
            {batch.product.packSize ? ` · ${batch.product.packSize}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'batch',
      header: 'Batch',
      render: (batch) => <span className="font-mono text-xs text-ink-700">{batch.batchNumber}</span>,
    },
    {
      key: 'expiry',
      header: 'Expiry',
      render: (batch) => (
        <div className="space-y-1">
          <p className="text-xs text-ink-700">{formatDate(batch.expiryDate, 'MMM yyyy')}</p>
          <ExpiryBadge days={batch.daysToExpiry} />
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (batch) => (
        <div className="text-xs">
          <p className="text-sm font-medium text-ink-900">{number(batch.availableQty)} available</p>
          <p className="text-ink-500">
            {number(batch.quantity + batch.freeQuantity)} on hand
            {batch.reservedQty > 0 ? ` · ${number(batch.reservedQty)} reserved` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      hideOnMobile: true,
      render: (batch) => (
        <div className="text-xs">
          <p className="font-medium text-ink-800">{currency(batch.stockValue)}</p>
          <p className="text-ink-500">
            cost {currency(batch.purchasePrice)} · MRP {currency(batch.mrp)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (batch) => (
        <Badge
          tone={
            batch.status === 'ACTIVE'
              ? 'success'
              : batch.status === 'EXPIRED'
                ? 'danger'
                : batch.status === 'BLOCKED'
                  ? 'warning'
                  : 'neutral'
          }
        >
          {humanize(batch.status)}
        </Badge>
      ),
    },
    ...(showWarehousePicker
      ? ([
          {
            key: 'warehouse',
            header: 'Warehouse',
            hideOnMobile: true,
            render: (batch) => (
              <span className="text-xs text-ink-600">{batch.warehouse?.name ?? '—'}</span>
            ),
          },
        ] satisfies Column<InventoryBatch>[])
      : []),
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (batch) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          onClick={() => setAdjusting(batch)}
        >
          Adjust
        </Button>
      ),
    },
  ];

  const expiryColumns: Column<InventoryBatch>[] = [
    ...batchColumns.filter((column) => column.key !== 'actions'),
    {
      key: 'clearance',
      header: 'Clearance',
      render: (batch) => {
        if (!batch.suggestedClearancePct || !batch.catalogEntryId || !batch.catalogMrp) {
          return <span className="text-xs text-ink-400">—</span>;
        }
        const alreadyApplied = (batch.catalogDiscountPct ?? 0) >= batch.suggestedClearancePct;
        if (alreadyApplied) {
          return <Badge tone="success">{batch.suggestedClearancePct}% applied</Badge>;
        }
        return (
          <Button
            variant="outline"
            size="sm"
            loading={
              applyClearance.isPending &&
              applyClearance.variables?.catalogEntryId === batch.catalogEntryId
            }
            onClick={() =>
              applyClearance.mutate({
                catalogEntryId: batch.catalogEntryId!,
                discountPct: batch.suggestedClearancePct!,
                sellingPrice:
                  Math.round(batch.catalogMrp! * (1 - batch.suggestedClearancePct! / 100) * 100) / 100,
              })
            }
          >
            Suggest {batch.suggestedClearancePct}% off
          </Button>
        );
      },
    },
  ];

  const transactionColumns: Column<InventoryTransaction>[] = [
    {
      key: 'when',
      header: 'When',
      render: (txn) => <span className="text-xs text-ink-600">{formatDate(txn.createdAt, 'dd MMM, HH:mm')}</span>,
    },
    {
      key: 'product',
      header: 'Product',
      render: (txn) => (
        <div>
          <p className="text-sm text-ink-800">{txn.product.name}</p>
          <p className="font-mono text-xs text-ink-500">{txn.batch?.batchNumber ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (txn) => <Badge tone="neutral">{humanize(txn.type)}</Badge>,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (txn) => (
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            txn.direction === 'IN'
              ? 'text-success'
              : txn.direction === 'OUT'
                ? 'text-danger'
                : 'text-ink-600',
          )}
        >
          {txn.direction === 'IN' ? '+' : txn.direction === 'OUT' ? '−' : ''}
          {number(txn.quantity)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      hideOnMobile: true,
      render: (txn) => (
        <span className="text-sm tabular-nums text-ink-600">
          {txn.balanceAfter === null ? '—' : number(txn.balanceAfter)}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      hideOnMobile: true,
      render: (txn) => (
        <span className="text-xs text-ink-500">{humanize(txn.referenceType) ?? '—'}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Batch-wise stock with expiry tracking. Every change writes an inventory transaction."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            Add stock
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Stock on hand"
          value={number(valuation?.totalUnits ?? 0)}
          hint={`${number(valuation?.totalBatches ?? 0)} active batches`}
          icon={<Layers className="h-5 w-5" />}
        />
        <StatCard
          label="Stock value (cost)"
          value={currency(valuation?.costValue ?? 0)}
          hint={`MRP value ${currency(valuation?.mrpValue ?? 0)}`}
          icon={<IndianRupee className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Expiring in 90 days"
          value={number(expirySummary?.buckets.find((bucket) => bucket.days === 90)?.batches ?? 0)}
          hint={`${currency(expirySummary?.stockValueAtRisk ?? 0)} at risk`}
          icon={<CalendarX2 className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Expired batches"
          value={number(expirySummary?.expired.batches ?? 0)}
          hint="Blocked from sale automatically"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="danger"
        />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              view === item.key
                ? 'bg-brand-700 text-white'
                : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === 'batches' ? (
        <DataTable
          columns={batchColumns}
          rows={batches.rows}
          rowKey={(batch) => batch.id}
          loading={batches.isLoading}
          error={batches.error}
          onRetry={() => void batches.refetch()}
          meta={batches.meta}
          onPageChange={batches.setPage}
          emptyTitle="No stock yet"
          emptyDescription="Add opening stock, or receive a purchase order to build your inventory."
          emptyAction={<Button onClick={() => setAddOpen(true)}>Add stock</Button>}
          toolbar={
            <FilterBar>
              <SearchInput
                value={batches.search}
                onChange={batches.setSearch}
                placeholder="Search by product or SKU"
                className="w-full sm:w-72"
              />
              <Select
                aria-label="Batch status"
                value={(batches.filters.status as string) ?? 'ALL'}
                onChange={(event) => batches.setFilter('status', event.target.value)}
                className="w-40"
                options={[
                  { value: 'ALL', label: 'All batches' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'EXPIRED', label: 'Expired' },
                  { value: 'BLOCKED', label: 'Blocked' },
                  { value: 'DEPLETED', label: 'Depleted' },
                ]}
              />
              {showWarehousePicker ? (
                <Select
                  aria-label="Warehouse"
                  value={(batches.filters.warehouseId as string) ?? 'ALL'}
                  onChange={(event) =>
                    batches.setFilter(
                      'warehouseId',
                      event.target.value === 'ALL' ? undefined : event.target.value,
                    )
                  }
                  className="w-44"
                  options={[
                    { value: 'ALL', label: 'All warehouses' },
                    ...warehouseOptions.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
                  ]}
                />
              ) : null}
            </FilterBar>
          }
        />
      ) : null}

      {view === 'expiry' ? (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Expired</p>
                <p className="mt-1 text-lg font-semibold text-danger">
                  {number(expirySummary?.expired.batches ?? 0)} batches
                </p>
              </div>
              {expirySummary?.buckets.map((bucket) => (
                <div key={bucket.days}>
                  <p className="text-xs uppercase tracking-wide text-ink-500">
                    Within {bucket.days} days
                  </p>
                  <p className="mt-1 text-lg font-semibold text-ink-900">
                    {number(bucket.batches)} batches
                  </p>
                  <p className="text-xs text-ink-500">{number(bucket.quantity)} units</p>
                </div>
              ))}
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Value at risk</p>
                <p className="mt-1 text-lg font-semibold text-warning">
                  {currency(expirySummary?.stockValueAtRisk ?? 0)}
                </p>
              </div>
            </div>
          </Card>

          <DataTable
            columns={expiryColumns}
            rows={expiring.rows}
            rowKey={(batch) => batch.id}
            loading={expiring.isLoading}
            error={expiring.error}
            onRetry={() => void expiring.refetch()}
            meta={expiring.meta}
            onPageChange={expiring.setPage}
            emptyTitle="Nothing expiring soon"
            emptyDescription="No batches fall inside the selected window."
            toolbar={
              <FilterBar>
                <Select
                  label="Expiring within"
                  value={String(expiring.filters.days ?? 90)}
                  onChange={(event) => expiring.setFilter('days', event.target.value)}
                  className="w-44"
                  options={[
                    { value: '30', label: '30 days' },
                    { value: '60', label: '60 days' },
                    { value: '90', label: '90 days' },
                    { value: '180', label: '6 months' },
                  ]}
                />
              </FilterBar>
            }
          />
        </>
      ) : null}

      {view === 'low-stock' ? (
        <>
          {loadingReorder ? null : reorderSuggestions && reorderSuggestions.length > 0 ? (
            <Card padded={false} className="mb-4 overflow-hidden border-warning">
              <div className="border-b border-ink-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-ink-900">Reorder soon</h3>
                <p className="text-xs text-ink-500">
                  Selling faster than the current stock will last — distinct from the fixed minimum-stock
                  list below.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-ink-50">
                  <tr className="border-b border-ink-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Available
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Sold / day
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Stock left
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reorderSuggestions.map((row) => (
                    <tr key={row.productId} className="border-b border-ink-100 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900">{row.name}</p>
                        <p className="text-xs text-ink-500">{row.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{number(row.availableQty)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-600">
                        {row.velocityPerDay.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-warning">
                        {row.daysOfStockLeft === null ? '—' : `${row.daysOfStockLeft} days`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}

          <Card padded={false} className="overflow-hidden">
          {loadingLowStock ? (
            <SkeletonRows columns={4} />
          ) : !lowStock || lowStock.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-500">
              Every product is above its minimum stock level.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-50">
                <tr className="border-b border-ink-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Product
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Available
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Minimum
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Shortfall
                  </th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((row) => (
                  <tr key={row.productId} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{row.name}</p>
                      <p className="text-xs text-ink-500">{row.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={row.availableQty === 0 ? 'font-semibold text-danger' : ''}>
                        {number(row.availableQty)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-600">
                      {number(row.minStockAlert)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-warning">
                      {number(Math.max(0, row.minStockAlert - row.availableQty))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </Card>
        </>
      ) : null}

      {view === 'transactions' ? (
        <DataTable
          columns={transactionColumns}
          rows={transactions.rows}
          rowKey={(txn) => txn.id}
          loading={transactions.isLoading}
          error={transactions.error}
          onRetry={() => void transactions.refetch()}
          meta={transactions.meta}
          onPageChange={transactions.setPage}
          emptyTitle="No stock movements yet"
          emptyDescription="Purchases, sales, adjustments and write-offs all appear here."
          toolbar={
            <FilterBar>
              <Select
                aria-label="Transaction type"
                value={(transactions.filters.type as string) ?? 'ALL'}
                onChange={(event) => transactions.setFilter('type', event.target.value)}
                className="w-48"
                options={[
                  { value: 'ALL', label: 'All movements' },
                  { value: 'OPENING_STOCK', label: 'Opening stock' },
                  { value: 'PURCHASE', label: 'Purchase' },
                  { value: 'SALE', label: 'Sale' },
                  { value: 'ORDER_RESERVATION', label: 'Reservation' },
                  { value: 'ORDER_RELEASE', label: 'Release' },
                  { value: 'ADJUSTMENT', label: 'Adjustment' },
                  { value: 'DAMAGE', label: 'Damage' },
                  { value: 'EXPIRED', label: 'Expired' },
                  { value: 'PURCHASE_RETURN', label: 'Purchase return' },
                ]}
              />
              {showWarehousePicker ? (
                <Select
                  aria-label="Warehouse"
                  value={(transactions.filters.warehouseId as string) ?? 'ALL'}
                  onChange={(event) =>
                    transactions.setFilter(
                      'warehouseId',
                      event.target.value === 'ALL' ? undefined : event.target.value,
                    )
                  }
                  className="w-44"
                  options={[
                    { value: 'ALL', label: 'All warehouses' },
                    ...warehouseOptions.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
                  ]}
                />
              ) : null}
            </FilterBar>
          }
        />
      ) : null}

      <AddStockModal
        open={addOpen}
        basePath={basePath}
        initialProduct={pendingAddStockProduct}
        warehouses={warehouseOptions}
        onClose={() => {
          setAddOpen(false);
          setPendingAddStockProduct(null);
        }}
        onSaved={invalidate}
      />

      <Modal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title="Adjust batch quantity"
        description={
          adjusting
            ? `${adjusting.product.name} · batch ${adjusting.batchNumber}`
            : undefined
        }
        size="sm"
      >
        <AdjustForm
          batch={adjusting}
          loading={adjust.isPending}
          onCancel={() => setAdjusting(null)}
          onSubmit={(quantity, reason) =>
            adjusting && adjust.mutate({ id: adjusting.id, quantity, reason })
          }
        />
      </Modal>
    </>
  );
}

function AdjustForm({
  batch,
  loading,
  onCancel,
  onSubmit,
}: {
  batch: InventoryBatch | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (quantity: number, reason: string) => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  if (!batch) return null;

  const onHand = batch.quantity + batch.freeQuantity;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
        <p className="text-ink-600">
          Currently <span className="font-semibold text-ink-900">{number(onHand)}</span> on hand,{' '}
          <span className="font-semibold text-ink-900">{number(batch.reservedQty)}</span> reserved for
          open orders.
        </p>
      </div>

      <Input
        label="Corrected quantity on hand"
        type="number"
        min={batch.reservedQty}
        required
        placeholder={String(onHand)}
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        hint="Cannot go below the reserved quantity"
      />

      <Textarea
        label="Reason"
        required
        placeholder="Physical stock count, breakage, correction after audit…"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          loading={loading}
          onClick={() => {
            if (quantity === '' || reason.trim().length < 3) {
              toast.error('Enter the corrected quantity and a reason');
              return;
            }
            onSubmit(Number(quantity), reason.trim());
          }}
        >
          Save adjustment
        </Button>
      </div>
    </div>
  );
}

function AddStockModal({
  open,
  basePath,
  initialProduct,
  warehouses,
  onClose,
  onSaved,
}: {
  open: boolean;
  basePath: string;
  initialProduct?: Product | null;
  warehouses: Warehouse[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [productSearch, setProductSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState<string>(
    () => warehouses.find((warehouse) => warehouse.isDefault)?.id ?? '',
  );
  // A hand-off product (see the pending-add-stock flow above) is present from
  // this component's very first render, so a plain lazy initializer skips the
  // search step — no effect needed to sync a prop that's already correct on mount.
  const [product, setProduct] = useState<Product | null>(() => initialProduct ?? null);
  const [form, setForm] = useState(() => ({
    batchNumber: '',
    quantity: '',
    freeQuantity: '0',
    purchasePrice: '',
    sellingPrice: initialProduct ? String(initialProduct.mrp) : '',
    mrp: initialProduct ? String(initialProduct.mrp) : '',
    gstRate: initialProduct ? String(initialProduct.gstRate) : '12',
    manufacturingDate: '',
    expiryDate: '',
    supplierName: '',
    notes: '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: products, isLoading } = useQuery({
    queryKey: queryKeys.products.list({ stockPicker: productSearch }),
    queryFn: () => getList<Product>('/products', { search: productSearch, status: 'ACTIVE', limit: 20 }),
    enabled: open && !product,
  });

  const save = useMutation({
    mutationFn: () =>
      post(`${basePath}/batches`, {
        productId: product!.id,
        warehouseId: warehouseId || undefined,
        batchNumber: form.batchNumber,
        quantity: Number(form.quantity),
        freeQuantity: Number(form.freeQuantity || 0),
        purchasePrice: Number(form.purchasePrice || 0),
        sellingPrice: Number(form.sellingPrice || 0),
        mrp: Number(form.mrp || 0),
        gstRate: Number(form.gstRate || 0),
        manufacturingDate: form.manufacturingDate || undefined,
        expiryDate: form.expiryDate,
        supplierName: form.supplierName || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Stock added');
      setProduct(null);
      setErrors({});
      setWarehouseId(warehouses.find((warehouse) => warehouse.isDefault)?.id ?? '');
      onSaved();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        if (Object.keys(error.fieldErrors).length === 0) toast.error(error.message);
      }
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        setProduct(null);
        onClose();
      }}
      title={product ? `Add stock — ${product.name}` : 'Add stock'}
      description={
        product
          ? 'Batch number and expiry are mandatory: stock is consumed first-expiry-first-out.'
          : 'Choose the product you are stocking.'
      }
      size="lg"
      footer={
        product ? (
          <>
            <Button variant="outline" onClick={() => setProduct(null)}>
              Back
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Add stock
            </Button>
          </>
        ) : undefined
      }
    >
      {!product ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            <SearchInput
              value={productSearch}
              onChange={setProductSearch}
              placeholder="Search the master catalogue"
              className="flex-1"
            />
            <BarcodeScanButton onDetect={setProductSearch} />
          </div>
          {isLoading ? (
            <SkeletonRows rows={4} columns={2} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {products?.data.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{item.name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {[item.brandName, item.packSize].filter(Boolean).join(' · ')} · MRP{' '}
                      {currency(item.mrp)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setProduct(item);
                      setForm((current) => ({
                        ...current,
                        mrp: String(item.mrp),
                        sellingPrice: String(item.mrp),
                        gstRate: String(item.gstRate),
                      }));
                    }}
                  >
                    Select
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {warehouses.length > 1 ? (
            <Select
              label="Warehouse"
              className="sm:col-span-2"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
            />
          ) : null}
          <Input
            label="Batch number"
            required
            placeholder="AB1234"
            value={form.batchNumber}
            error={errors.batchNumber}
            onChange={(event) =>
              setForm((current) => ({ ...current, batchNumber: event.target.value }))
            }
          />
          <Input
            label="Expiry date"
            type="date"
            required
            min={todayISO(1)}
            value={form.expiryDate}
            error={errors.expiryDate}
            hint="Expired batches can never be sold"
            onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))}
          />
          <Input
            label="Quantity"
            type="number"
            required
            value={form.quantity}
            error={errors.quantity}
            onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
          />
          <Input
            label="Free quantity"
            type="number"
            hint="Scheme or bonus units received"
            value={form.freeQuantity}
            onChange={(event) =>
              setForm((current) => ({ ...current, freeQuantity: event.target.value }))
            }
          />
          <Input
            label="Purchase price (per unit)"
            type="number"
            step="0.01"
            value={form.purchasePrice}
            error={errors.purchasePrice}
            hint="Drives cost of goods and margin"
            onChange={(event) =>
              setForm((current) => ({ ...current, purchasePrice: event.target.value }))
            }
          />
          <Input
            label="MRP"
            type="number"
            step="0.01"
            value={form.mrp}
            onChange={(event) => setForm((current) => ({ ...current, mrp: event.target.value }))}
          />
          <Input
            label="Selling price"
            type="number"
            step="0.01"
            value={form.sellingPrice}
            onChange={(event) =>
              setForm((current) => ({ ...current, sellingPrice: event.target.value }))
            }
          />
          <Select
            label="GST rate"
            value={form.gstRate}
            onChange={(event) => setForm((current) => ({ ...current, gstRate: event.target.value }))}
            options={[
              { value: '0', label: '0%' },
              { value: '5', label: '5%' },
              { value: '12', label: '12%' },
              { value: '18', label: '18%' },
              { value: '28', label: '28%' },
            ]}
          />
          <Input
            label="Manufacturing date"
            type="date"
            max={todayISO()}
            value={form.manufacturingDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, manufacturingDate: event.target.value }))
            }
          />
          <Input
            label="Supplier"
            placeholder="Who supplied this batch"
            value={form.supplierName}
            onChange={(event) =>
              setForm((current) => ({ ...current, supplierName: event.target.value }))
            }
          />
          <Textarea
            label="Notes"
            className="sm:col-span-2"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>
      )}
    </Modal>
  );
}
