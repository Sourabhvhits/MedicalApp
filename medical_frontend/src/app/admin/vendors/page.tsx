'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { patch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { formatDate } from '@/lib/utils';
import type { ApprovalStatus, Vendor } from '@/lib/types';
import { Button, PageHeader, Select } from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { ApprovalBadge } from '@/components/ui/status';
import { ApprovalDialog } from '@/components/approval-dialog';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

export default function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Vendor | null>(null);

  const list = useListQuery<Vendor>('/admin/vendors', queryKeys.admin.vendors);

  const decide = useMutation({
    mutationFn: (input: { id: string; decision: ApprovalStatus; reason?: string }) =>
      patch(`/admin/vendors/${input.id}/approval`, {
        decision: input.decision,
        reason: input.reason,
      }),
    onSuccess: (_data, variables) => {
      toast.success(`Wholesaler ${variables.decision.toLowerCase().replace('_', ' ')}`);
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });

  const columns: Column<Vendor>[] = [
    {
      key: 'business',
      header: 'Wholesaler',
      render: (vendor) => (
        <div>
          <p className="font-medium text-ink-900">{vendor.businessName}</p>
          <p className="text-xs text-ink-500">
            {vendor.code} · {vendor.contactPerson ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideOnMobile: true,
      render: (vendor) => (
        <div className="text-xs">
          <p className="text-ink-700">{vendor.phone}</p>
          <p className="text-ink-500">{vendor.email ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      hideOnMobile: true,
      render: (vendor) => (
        <span className="text-sm text-ink-600">
          {[vendor.city, vendor.state].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'compliance',
      header: 'GST / licence',
      hideOnMobile: true,
      render: (vendor) => (
        <div className="text-xs">
          <p className="text-ink-700">{vendor.gstNumber ?? 'No GSTIN'}</p>
          <p className="text-ink-500">{vendor.drugLicenseNumber ?? 'No drug licence'}</p>
        </div>
      ),
    },
    {
      key: 'catalog',
      header: 'Products',
      hideOnMobile: true,
      render: (vendor) => <span className="text-sm">{vendor._count?.products ?? 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (vendor) => <ApprovalBadge status={vendor.approvalStatus} />,
    },
    {
      key: 'registered',
      header: 'Registered',
      hideOnMobile: true,
      render: (vendor) => <span className="text-xs text-ink-500">{formatDate(vendor.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (vendor) => (
        <div className="flex justify-end gap-2">
          <Link href={`/admin/vendors/${vendor.id}`}>
            <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}>
              View
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => setTarget(vendor)}>
            Review
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Wholesalers"
        description="Review registrations and control which suppliers can trade on the platform."
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(vendor) => vendor.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="No wholesalers found"
        emptyDescription="Adjust your filters, or wait for new registrations to arrive."
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by name, code, phone or GSTIN"
              className="w-full sm:w-80"
            />
            <Select
              aria-label="Approval status"
              value={(list.filters.approvalStatus as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('approvalStatus', event.target.value)}
              options={STATUS_OPTIONS}
              className="w-48"
            />
          </FilterBar>
        }
      />

      <ApprovalDialog
        open={Boolean(target)}
        title={`Review ${target?.businessName ?? ''}`}
        currentStatus={target?.approvalStatus}
        loading={decide.isPending}
        onClose={() => setTarget(null)}
        onSubmit={(decision, reason) =>
          target && decide.mutate({ id: target.id, decision, reason })
        }
      />
    </>
  );
}
