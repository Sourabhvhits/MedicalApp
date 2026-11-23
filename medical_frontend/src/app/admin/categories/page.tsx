'use client';

import { queryKeys } from '@/lib/query-keys';
import type { Category } from '@/lib/types';
import { MasterCrudPage } from '@/components/master-crud';
import { RecordStatusBadge } from '@/components/ui/status';
import type { Column } from '@/components/ui/data-table';

const columns: Column<Category>[] = [
  {
    key: 'name',
    header: 'Category',
    render: (category) => (
      <div>
        <p className="font-medium text-ink-900">{category.name}</p>
        <p className="text-xs text-ink-500">{category.slug}</p>
      </div>
    ),
  },
  {
    key: 'subCategories',
    header: 'Sub categories',
    hideOnMobile: true,
    render: (category) => <span className="text-sm">{category._count?.subCategories ?? 0}</span>,
  },
  {
    key: 'products',
    header: 'Products',
    hideOnMobile: true,
    render: (category) => <span className="text-sm">{category._count?.products ?? 0}</span>,
  },
  {
    key: 'sortOrder',
    header: 'Order',
    hideOnMobile: true,
    render: (category) => <span className="text-sm text-ink-500">{category.sortOrder}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (category) => <RecordStatusBadge status={category.status} />,
  },
];

export default function AdminCategoriesPage() {
  return (
    <MasterCrudPage<Category>
      title="Categories"
      description="The top level of the catalogue tree: category, sub category, then products."
      singular="Category"
      endpoint="/admin/categories"
      queryKeyFactory={queryKeys.masters.categories}
      columns={columns}
      searchPlaceholder="Search categories"
      fields={[
        { name: 'name', label: 'Category name', required: true, placeholder: 'Tablets' },
        { name: 'sortOrder', label: 'Display order', type: 'number', defaultValue: 0 },
        {
          name: 'description',
          label: 'Description',
          fullWidth: true,
          placeholder: 'Shown to customers when browsing',
        },
      ]}
      toFormValues={(category) => ({
        name: category.name,
        sortOrder: category.sortOrder,
        status: category.status,
      })}
    />
  );
}
