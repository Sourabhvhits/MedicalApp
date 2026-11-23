'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ApiError, del, getList, post, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { currency, percent } from '@/lib/utils';
import type { CatalogEntry, Category, Product } from '@/lib/types';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonRows,
} from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { RecordStatusBadge, StockBadge } from '@/components/ui/status';
import { CatalogImportExport } from '@/components/catalog-import-export';

type Variant = 'vendor' | 'retailer';

/** Shared with `InventoryWorkspace` — hands off which product to pre-fill
 * in "Add stock" after a fresh catalogue add, without prop-drilling across
 * the separate /products and /inventory routes. */
const PENDING_ADD_STOCK_KEY = 'medmarket:pendingAddStock';

interface CatalogManagerProps {
  variant: Variant;
  endpoint: string;
  queryKeyFactory: (params: Record<string, string | number | boolean | undefined>) => readonly unknown[];
}

interface PriceForm {
  sellingPrice: string;
  mrp: string;
  gstRate: string;
  discountPct: string;
  minStockAlert: string;
  purchasePrice: string;
  minOrderQty: string;
  packQty: string;
  maxOrderQty: string;
  status: string;
}

const EMPTY_FORM: PriceForm = {
  sellingPrice: '',
  mrp: '',
  gstRate: '12',
  discountPct: '0',
  minStockAlert: '10',
  purchasePrice: '',
  minOrderQty: '1',
  packQty: '1',
  maxOrderQty: '20',
  status: 'ACTIVE',
};

/**
 * Catalogue screen for vendors and medical shops. Both pick products from the
 * central master and set their own commercial terms — so they share this
 * component, with only the pricing fields differing.
 */
export function CatalogManager({ variant, endpoint, queryKeyFactory }: CatalogManagerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editing, setEditing] = useState<CatalogEntry | null>(null);
  const [form, setForm] = useState<PriceForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<CatalogEntry | null>(null);
  const [justAdded, setJustAdded] = useState<Product | null>(null);
  const inventoryPath = variant === 'vendor' ? '/vendor/inventory' : '/retailer/inventory';

  const list = useListQuery<CatalogEntry>(endpoint, queryKeyFactory);

  const { data: categories } = useQuery({
    queryKey: queryKeys.masters.categories({ limit: 100 }),
    queryFn: () => getList<Category>('/admin/categories', { limit: 100, status: 'ACTIVE' }),
  });

  // Master products available to add, excluding what is already listed.
  const { data: masterProducts, isLoading: loadingProducts } = useQuery({
    queryKey: queryKeys.products.list({ picker: productSearch }),
    queryFn: () => getList<Product>('/products', { search: productSearch, status: 'ACTIVE', limit: 25 }),
    enabled: pickerOpen,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: variant === 'vendor' ? queryKeys.vendor.all : queryKeys.retailer.all,
    });
  };

  const save = useMutation({
    mutationFn: () => {
      const shared = {
        sellingPrice: Number(form.sellingPrice),
        mrp: Number(form.mrp),
        gstRate: Number(form.gstRate),
        discountPct: Number(form.discountPct),
        minStockAlert: Number(form.minStockAlert),
        status: form.status,
      };

      const payload =
        variant === 'vendor'
          ? {
              ...shared,
              purchasePrice: Number(form.purchasePrice || 0),
              minOrderQty: Number(form.minOrderQty),
              packQty: Number(form.packQty),
            }
          : { ...shared, maxOrderQty: Number(form.maxOrderQty) };

      return editing
        ? put(`${endpoint}/${editing.id}`, payload)
        : post(endpoint, { ...payload, productId: selectedProduct!.id });
    },
    onSuccess: () => {
      toast.success(editing ? 'Listing updated' : 'Product added to your catalogue');
      // A fresh add has zero stock until "Add stock" is used separately — prompt
      // straight into that instead of leaving the user to discover the
      // Inventory tab on their own (see TASKS.md #0).
      if (!editing && selectedProduct) setJustAdded(selectedProduct);
      setEditing(null);
      setSelectedProduct(null);
      setErrors({});
      invalidate();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        if (Object.keys(error.fieldErrors).length === 0) toast.error(error.message);
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`${endpoint}/${id}`),
    onSuccess: () => {
      toast.success('Removed from your catalogue');
      setRemoving(null);
      invalidate();
    },
  });

  const startAdd = (product: Product) => {
    setSelectedProduct(product);
    setPickerOpen(false);
    setEditing(null);
    setErrors({});
    setForm({
      ...EMPTY_FORM,
      mrp: String(product.mrp),
      sellingPrice: String(product.mrp),
      gstRate: String(product.gstRate),
    });
  };

  const startEdit = (entry: CatalogEntry) => {
    setEditing(entry);
    setSelectedProduct(null);
    setErrors({});
    setForm({
      sellingPrice: String(entry.sellingPrice),
      mrp: String(entry.mrp),
      gstRate: String(entry.gstRate),
      discountPct: String(entry.discountPct),
      minStockAlert: String(entry.minStockAlert),
      purchasePrice: String(entry.purchasePrice ?? 0),
      minOrderQty: String(entry.minOrderQty ?? 1),
      packQty: '1',
      maxOrderQty: String(entry.maxOrderQty ?? 20),
      status: entry.status,
    });
  };

  const formOpen = Boolean(editing || selectedProduct);

  const columns: Column<CatalogEntry>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (entry) => (
        <div>
          <p className="font-medium text-ink-900">{entry.product.name}</p>
          <p className="text-xs text-ink-500">
            {entry.product.sku}
            {entry.product.packSize ? ` · ${entry.product.packSize}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideOnMobile: true,
      render: (entry) => (
        <span className="text-xs text-ink-600">{entry.product.category?.name ?? '—'}</span>
      ),
    },
    {
      key: 'pricing',
      header: variant === 'vendor' ? 'Wholesale price' : 'Selling price',
      render: (entry) => (
        <div>
          <p className="font-medium text-ink-900">{currency(entry.sellingPrice)}</p>
          <p className="text-xs text-ink-500">
            MRP {currency(entry.mrp)}
            {Number(entry.discountPct) > 0 ? ` · ${percent(entry.discountPct, 0)} off` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'gst',
      header: 'GST',
      hideOnMobile: true,
      render: (entry) => <span className="text-sm">{Number(entry.gstRate)}%</span>,
    },
    {
      key: 'stock',
      header: 'Available',
      render: (entry) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink-800">{entry.availableQty}</p>
          <StockBadge available={entry.availableQty} minimum={entry.minStockAlert} />
        </div>
      ),
    },
    {
      key: 'flags',
      header: '',
      hideOnMobile: true,
      render: (entry) =>
        entry.product.prescriptionRequired ? <Badge tone="warning">Rx</Badge> : null,
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry) => <RecordStatusBadge status={entry.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (entry) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => startEdit(entry)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setRemoving(entry)}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Catalogue"
        description={
          variant === 'vendor'
            ? 'Products you supply to medical shops, with your wholesale pricing and order rules.'
            : 'Products your store sells to customers, with your selling price and stock alerts.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CatalogImportExport
              basePath={endpoint}
              filename="my-catalogue"
              onImported={() => void list.refetch()}
            />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setPickerOpen(true)}>
              Add product
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(entry) => entry.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="Your catalogue is empty"
        emptyDescription="Add products from the central master catalogue and set your own prices."
        emptyAction={<Button onClick={() => setPickerOpen(true)}>Add your first product</Button>}
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search your catalogue"
              className="w-full sm:w-72"
            />
            <Select
              aria-label="Category"
              value={(list.filters.categoryId as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('categoryId', event.target.value)}
              className="w-44"
            >
              <option value="ALL">All categories</option>
              {categories?.data.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Status"
              value={(list.filters.status as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('status', event.target.value)}
              className="w-40"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
            {variant === 'retailer' ? (
              <Select
                aria-label="Stock"
                value={(list.filters.lowStockOnly as string) ?? 'ALL'}
                onChange={(event) => list.setFilter('lowStockOnly', event.target.value)}
                className="w-40"
                options={[
                  { value: 'ALL', label: 'All stock' },
                  { value: 'true', label: 'Low stock only' },
                ]}
              />
            ) : null}
          </FilterBar>
        }
      />

      {/* Step 1 — choose from the master catalogue */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add from the master catalogue"
        description="Every product comes from the platform's central catalogue — you set your own price."
        size="lg"
      >
        <SearchInput
          value={productSearch}
          onChange={setProductSearch}
          placeholder="Search by name, generic name or brand"
          className="mb-4"
        />

        {loadingProducts ? (
          <SkeletonRows rows={4} columns={2} />
        ) : !masterProducts || masterProducts.data.length === 0 ? (
          <EmptyState
            title="No products match"
            description="Try a different search term. New products are added by the platform admin."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {masterProducts.data.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{product.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {[product.brandName, product.strength, product.packSize].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    MRP {currency(product.mrp)} · {Number(product.gstRate)}% GST
                    {product.prescriptionRequired ? ' · Prescription required' : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => startAdd(product)}>
                  Select
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Step 2 — set commercial terms */}
      <Modal
        open={formOpen}
        onClose={() => {
          setEditing(null);
          setSelectedProduct(null);
        }}
        title={editing ? `Edit ${editing.product.name}` : `Add ${selectedProduct?.name ?? ''}`}
        description={
          variant === 'vendor'
            ? 'Your wholesale terms for this product.'
            : 'Your retail terms for this product.'
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setSelectedProduct(null);
              }}
            >
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              {editing ? 'Save changes' : 'Add to catalogue'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="MRP"
            type="number"
            step="0.01"
            required
            value={form.mrp}
            error={errors.mrp}
            onChange={(event) => setForm((current) => ({ ...current, mrp: event.target.value }))}
          />
          <Input
            label={variant === 'vendor' ? 'Wholesale selling price' : 'Selling price'}
            type="number"
            step="0.01"
            required
            hint="Cannot exceed MRP"
            value={form.sellingPrice}
            error={errors.sellingPrice}
            onChange={(event) =>
              setForm((current) => ({ ...current, sellingPrice: event.target.value }))
            }
          />

          {variant === 'vendor' ? (
            <Input
              label="Your purchase cost"
              type="number"
              step="0.01"
              hint="Used for margin reporting"
              value={form.purchasePrice}
              error={errors.purchasePrice}
              onChange={(event) =>
                setForm((current) => ({ ...current, purchasePrice: event.target.value }))
              }
            />
          ) : null}

          <Select
            label="GST rate"
            value={form.gstRate}
            onChange={(event) => setForm((current) => ({ ...current, gstRate: event.target.value }))}
            options={[
              { value: '0', label: '0% (exempt)' },
              { value: '5', label: '5%' },
              { value: '12', label: '12%' },
              { value: '18', label: '18%' },
              { value: '28', label: '28%' },
            ]}
          />

          <Input
            label="Discount %"
            type="number"
            step="0.01"
            value={form.discountPct}
            error={errors.discountPct}
            onChange={(event) =>
              setForm((current) => ({ ...current, discountPct: event.target.value }))
            }
          />

          <Input
            label="Low stock alert at"
            type="number"
            hint="Alerts you when available stock drops to this level"
            value={form.minStockAlert}
            onChange={(event) =>
              setForm((current) => ({ ...current, minStockAlert: event.target.value }))
            }
          />

          {variant === 'vendor' ? (
            <>
              <Input
                label="Minimum order quantity"
                type="number"
                hint="Retailers must order at least this many"
                value={form.minOrderQty}
                error={errors.minOrderQty}
                onChange={(event) =>
                  setForm((current) => ({ ...current, minOrderQty: event.target.value }))
                }
              />
              <Input
                label="Pack quantity"
                type="number"
                value={form.packQty}
                onChange={(event) => setForm((current) => ({ ...current, packQty: event.target.value }))}
              />
            </>
          ) : (
            <Input
              label="Maximum per customer order"
              type="number"
              hint="Caps how many units one customer can order"
              value={form.maxOrderQty}
              error={errors.maxOrderQty}
              onChange={(event) =>
                setForm((current) => ({ ...current, maxOrderQty: event.target.value }))
              }
            />
          )}

          <Select
            label="Status"
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            options={[
              { value: 'ACTIVE', label: 'Active — visible to buyers' },
              { value: 'INACTIVE', label: 'Inactive — hidden' },
            ]}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        title="Remove from catalogue"
        message={`"${removing?.product.name}" will no longer be offered. Existing stock and order history are preserved.`}
        confirmLabel="Remove"
        loading={remove.isPending}
      />

      <ConfirmDialog
        open={Boolean(justAdded)}
        onClose={() => setJustAdded(null)}
        onConfirm={() => {
          if (!justAdded) return;
          try {
            sessionStorage.setItem(
              PENDING_ADD_STOCK_KEY,
              JSON.stringify({ scope: variant, product: justAdded }),
            );
          } catch {
            // Private browsing / storage disabled — still navigate, the
            // Inventory page's normal "Add stock" search step covers it.
          }
          router.push(inventoryPath);
          setJustAdded(null);
        }}
        title="Add opening stock?"
        message={`"${justAdded?.name}" has no stock yet, so it won't show as available until you add opening stock. Add it now?`}
        confirmLabel="Add stock now"
        tone="primary"
      />
    </>
  );
}
