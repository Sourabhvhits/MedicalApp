'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormik } from 'formik';
import { z } from 'zod';
import { toast } from 'sonner';
import { Ban, Pencil, Plus, Trash2 } from 'lucide-react';
import { ApiError, del, getList, patch, post, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { currency } from '@/lib/utils';
import { zodValidate } from '@/lib/zod-formik';
import type { Category, Manufacturer, Product, ProductUnit, SubCategory } from '@/lib/types';
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { RecordStatusBadge } from '@/components/ui/status';
import { CatalogImportExport } from '@/components/catalog-import-export';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the product name').max(191),
  genericName: z.string().trim().max(191).optional(),
  brandName: z.string().trim().max(191).optional(),
  categoryId: z.string().uuid('Choose a category'),
  subCategoryId: z.string().optional(),
  manufacturerId: z.string().optional(),
  unitId: z.string().optional(),
  strength: z.string().trim().max(80).optional(),
  dosageForm: z.string().trim().max(80).optional(),
  packSize: z.string().trim().max(80).optional(),
  composition: z.string().trim().max(2000).optional(),
  mrp: z.coerce.number().positive('MRP must be greater than zero'),
  gstRate: z.coerce.number().min(0).max(100),
  hsnCode: z.string().trim().max(20).optional(),
  prescriptionRequired: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
});

type FormValues = z.infer<typeof schema>;
// The form's live values are always strings off the DOM (a <select> and a
// number <input> both hand back strings) — `FormValues` above is the
// post-`z.coerce` shape used only for the mutation payload.
type FormInput = Omit<FormValues, 'mrp' | 'gstRate'> & { mrp: string; gstRate: string };

const EMPTY_FORM: FormInput = {
  name: '',
  genericName: '',
  brandName: '',
  categoryId: '',
  subCategoryId: '',
  manufacturerId: '',
  unitId: '',
  strength: '',
  dosageForm: '',
  packSize: '',
  composition: '',
  mrp: '',
  gstRate: '12',
  hsnCode: '',
  prescriptionRequired: false,
  status: 'ACTIVE',
};

const GST_OPTIONS = [
  { value: '0', label: '0% (exempt)' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
];

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const list = useListQuery<Product>('/products', queryKeys.products.list);

  const { data: categories } = useQuery({
    queryKey: queryKeys.masters.categories({ limit: 100 }),
    queryFn: () => getList<Category>('/admin/categories', { limit: 100, status: 'ACTIVE' }),
  });
  const { data: manufacturers } = useQuery({
    queryKey: queryKeys.masters.manufacturers({ limit: 100 }),
    queryFn: () => getList<Manufacturer>('/admin/manufacturers', { limit: 100, status: 'ACTIVE' }),
  });
  const { data: units } = useQuery({
    queryKey: queryKeys.masters.units({ limit: 100 }),
    queryFn: () => getList<ProductUnit>('/admin/units', { limit: 100, status: 'ACTIVE' }),
  });

  const form = useFormik<FormInput>({
    initialValues: EMPTY_FORM,
    validate: zodValidate<FormValues, FormInput>(schema),
    onSubmit: (values) => {
      save.mutate({ ...values, mrp: Number(values.mrp), gstRate: Number(values.gstRate) });
    },
  });

  // No useWatch equivalent needed — formik.values is already live on every render.
  const selectedCategoryId = form.values.categoryId;
  const { data: subCategories } = useQuery({
    queryKey: queryKeys.masters.subCategories({ categoryId: selectedCategoryId }),
    queryFn: () =>
      getList<SubCategory>('/admin/sub-categories', {
        categoryId: selectedCategoryId,
        limit: 100,
        status: 'ACTIVE',
      }),
    enabled: Boolean(selectedCategoryId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  };

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        subCategoryId: values.subCategoryId || undefined,
        manufacturerId: values.manufacturerId || undefined,
        unitId: values.unitId || undefined,
      };
      return editing ? put(`/products/${editing.id}`, payload) : post('/products', payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Product updated' : 'Product added to the master catalogue');
      setFormOpen(false);
      setEditing(null);
      form.resetForm();
      invalidate();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          form.setFieldError(field, message);
          form.setFieldTouched(field, true, false);
        });
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`/products/${id}`),
    onSuccess: () => {
      toast.success('Product removed from the catalogue');
      setDeleting(null);
      invalidate();
    },
  });

  const toggleBlock = useMutation({
    mutationFn: (product: Product) =>
      patch(`/products/${product.id}/status`, {
        status: product.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED',
      }),
    onSuccess: () => {
      toast.success('Product status updated');
      invalidate();
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.resetForm({ values: EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    form.resetForm({
      values: {
        name: product.name,
        genericName: product.genericName ?? '',
        brandName: product.brandName ?? '',
        categoryId: product.categoryId,
        subCategoryId: product.subCategoryId ?? '',
        manufacturerId: product.manufacturerId ?? '',
        unitId: product.unitId ?? '',
        strength: product.strength ?? '',
        dosageForm: product.dosageForm ?? '',
        packSize: product.packSize ?? '',
        composition: product.composition ?? '',
        mrp: String(product.mrp),
        gstRate: String(product.gstRate),
        hsnCode: product.hsnCode ?? '',
        prescriptionRequired: product.prescriptionRequired,
        status: product.status,
      },
    });
    setFormOpen(true);
  };

  const columns: Column<Product>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (product) => (
        <div>
          <p className="font-medium text-ink-900">{product.name}</p>
          <p className="text-xs text-ink-500">
            {product.sku}
            {product.brandName ? ` · ${product.brandName}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'generic',
      header: 'Generic / strength',
      hideOnMobile: true,
      render: (product) => (
        <div className="text-xs">
          <p className="text-ink-700">{product.genericName ?? '—'}</p>
          <p className="text-ink-500">
            {[product.strength, product.packSize].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      hideOnMobile: true,
      render: (product) => (
        <div className="text-xs">
          <p className="text-ink-700">{product.category?.name ?? '—'}</p>
          <p className="text-ink-500">{product.manufacturer?.name ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'pricing',
      header: 'MRP / GST',
      render: (product) => (
        <div className="text-xs">
          <p className="font-medium text-ink-800">{currency(product.mrp)}</p>
          <p className="text-ink-500">{Number(product.gstRate)}% GST</p>
        </div>
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      hideOnMobile: true,
      render: (product) => (
        <div className="flex flex-wrap gap-1">
          {product.prescriptionRequired ? <Badge tone="warning">Rx</Badge> : null}
          {product.isRecalled ? <Badge tone="danger">Recalled</Badge> : null}
        </div>
      ),
    },
    {
      key: 'listings',
      header: 'Listed by',
      hideOnMobile: true,
      render: (product) => (
        <span className="text-xs text-ink-600">
          {product._count
            ? `${product._count.vendorProducts} vendors · ${product._count.retailerProducts} stores`
            : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (product) => <RecordStatusBadge status={product.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (product) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(product)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={product.status === 'BLOCKED' ? 'Unblock' : 'Block'}
            onClick={() => toggleBlock.mutate(product)}
          >
            <Ban className={product.status === 'BLOCKED' ? 'h-4 w-4 text-danger' : 'h-4 w-4'} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleting(product)}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Product master"
        description="The single catalogue every vendor and medical shop sells from — no duplicates."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CatalogImportExport
              basePath="/products"
              filename="master-products"
              onImported={() => void list.refetch()}
            />
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add product
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(product) => product.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="No products found"
        emptyDescription="Add your first master product, or clear the filters."
        emptyAction={<Button onClick={openCreate}>Add product</Button>}
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by name, generic, brand or SKU"
              className="w-full sm:w-80"
            />
            <Select
              aria-label="Category"
              value={(list.filters.categoryId as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('categoryId', event.target.value)}
              className="w-48"
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
                { value: 'BLOCKED', label: 'Blocked' },
              ]}
            />
          </FilterBar>
        }
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit product' : 'Add master product'}
        description="Vendors and stores select from this catalogue and set their own prices."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => form.handleSubmit()} loading={save.isPending}>
              {editing ? 'Save changes' : 'Add product'}
            </Button>
          </>
        }
      >
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <Input
            label="Product name"
            required
            className="sm:col-span-2"
            error={form.touched.name ? form.errors.name : undefined}
            {...form.getFieldProps('name')}
          />
          <Input label="Generic name" {...form.getFieldProps('genericName')} />
          <Input label="Brand name" {...form.getFieldProps('brandName')} />

          <Select
            label="Category"
            required
            error={form.touched.categoryId ? form.errors.categoryId : undefined}
            {...form.getFieldProps('categoryId')}
          >
            <option value="">Select a category</option>
            {categories?.data.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <Select label="Sub category" {...form.getFieldProps('subCategoryId')}>
            <option value="">None</option>
            {subCategories?.data.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </Select>

          <Select label="Manufacturer" {...form.getFieldProps('manufacturerId')}>
            <option value="">None</option>
            {manufacturers?.data.map((manufacturer) => (
              <option key={manufacturer.id} value={manufacturer.id}>
                {manufacturer.name}
              </option>
            ))}
          </Select>

          <Select label="Unit" {...form.getFieldProps('unitId')}>
            <option value="">None</option>
            {units?.data.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>

          <Input label="Strength" placeholder="500mg" {...form.getFieldProps('strength')} />
          <Input label="Dosage form" placeholder="Tablet" {...form.getFieldProps('dosageForm')} />
          <Input label="Pack size" placeholder="15 Tablets" {...form.getFieldProps('packSize')} />
          <Input label="HSN code" placeholder="30049099" {...form.getFieldProps('hsnCode')} />

          <Input
            label="MRP"
            type="number"
            step="0.01"
            required
            error={form.touched.mrp ? form.errors.mrp : undefined}
            {...form.getFieldProps('mrp')}
          />
          <Select label="GST rate" options={GST_OPTIONS} {...form.getFieldProps('gstRate')} />

          <Textarea
            label="Composition"
            className="sm:col-span-2"
            placeholder="Paracetamol 500mg"
            {...form.getFieldProps('composition')}
          />

          <Select
            label="Status"
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'BLOCKED', label: 'Blocked' },
            ]}
            {...form.getFieldProps('status')}
          />

          <div className="flex items-end">
            <Checkbox
              label="Prescription required"
              {...form.getFieldProps({ name: 'prescriptionRequired', type: 'checkbox' })}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="Delete product"
        message={`"${deleting?.name}" will be removed from the master catalogue and deactivated in every vendor and store listing. Order history is preserved.`}
        confirmLabel="Delete product"
        loading={remove.isPending}
      />
    </>
  );
}
