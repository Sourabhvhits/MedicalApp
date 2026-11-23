'use client';

import { queryKeys } from '@/lib/query-keys';
import type { Manufacturer } from '@/lib/types';
import { MasterCrudPage } from '@/components/master-crud';
import { RecordStatusBadge } from '@/components/ui/status';
import type { Column } from '@/components/ui/data-table';

const columns: Column<Manufacturer>[] = [
  {
    key: 'name',
    header: 'Company',
    render: (manufacturer) => (
      <div>
        <p className="font-medium text-ink-900">{manufacturer.name}</p>
        <p className="text-xs text-ink-500">{manufacturer.code}</p>
      </div>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    hideOnMobile: true,
    render: (manufacturer) => (
      <span className="text-sm text-ink-600">
        {[manufacturer.city, manufacturer.state].filter(Boolean).join(', ') || '—'}
      </span>
    ),
  },
  {
    key: 'gst',
    header: 'GSTIN',
    hideOnMobile: true,
    render: (manufacturer) => (
      <span className="font-mono text-xs text-ink-600">{manufacturer.gstNumber ?? '—'}</span>
    ),
  },
  {
    key: 'products',
    header: 'Products',
    hideOnMobile: true,
    render: (manufacturer) => <span className="text-sm">{manufacturer._count?.products ?? 0}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (manufacturer) => <RecordStatusBadge status={manufacturer.status} />,
  },
];

export default function AdminManufacturersPage() {
  return (
    <MasterCrudPage<Manufacturer>
      title="Manufacturers"
      description="Pharmaceutical companies whose products appear in the master catalogue."
      singular="Manufacturer"
      endpoint="/admin/manufacturers"
      queryKeyFactory={queryKeys.masters.manufacturers}
      columns={columns}
      searchPlaceholder="Search by name, code, city or GSTIN"
      fields={[
        { name: 'name', label: 'Company name', required: true, placeholder: 'Cipla Limited' },
        {
          name: 'code',
          label: 'Short code',
          required: true,
          placeholder: 'CIPLA',
          hint: 'Uppercase letters, numbers, - or _',
        },
        { name: 'contactPerson', label: 'Contact person' },
        { name: 'phone', label: 'Phone' },
        { name: 'email', label: 'Email' },
        { name: 'gstNumber', label: 'GSTIN' },
        { name: 'licenseNumber', label: 'Licence number' },
        { name: 'city', label: 'City' },
        { name: 'state', label: 'State' },
        { name: 'pincode', label: 'Pincode' },
      ]}
      toFormValues={(manufacturer) => ({
        name: manufacturer.name,
        code: manufacturer.code,
        city: manufacturer.city ?? '',
        state: manufacturer.state ?? '',
        gstNumber: manufacturer.gstNumber ?? '',
        status: manufacturer.status,
      })}
    />
  );
}
