'use client';

import { queryKeys } from '@/lib/query-keys';
import type { ProductUnit } from '@/lib/types';
import { MasterCrudPage } from '@/components/master-crud';
import { RecordStatusBadge } from '@/components/ui/status';
import type { Column } from '@/components/ui/data-table';

const columns: Column<ProductUnit>[] = [
  {
    key: 'name',
    header: 'Unit',
    render: (unit) => <span className="font-medium text-ink-900">{unit.name}</span>,
  },
  {
    key: 'code',
    header: 'Code',
    render: (unit) => <span className="font-mono text-xs text-ink-600">{unit.code}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (unit) => <RecordStatusBadge status={unit.status} />,
  },
];

export default function AdminUnitsPage() {
  return (
    <MasterCrudPage<ProductUnit>
      title="Units"
      description="Packaging units used when products are sold and stocked."
      singular="Unit"
      endpoint="/admin/units"
      queryKeyFactory={queryKeys.masters.units}
      columns={columns}
      searchPlaceholder="Search units"
      fields={[
        { name: 'name', label: 'Unit name', required: true, placeholder: 'Strip' },
        {
          name: 'code',
          label: 'Code',
          required: true,
          placeholder: 'STRIP',
          hint: 'Uppercase letters, numbers, - or _',
        },
      ]}
      toFormValues={(unit) => ({ name: unit.name, code: unit.code, status: unit.status })}
    />
  );
}
