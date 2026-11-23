'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Star } from 'lucide-react';
import { patch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { formatDate } from '@/lib/utils';
import type { ApprovalStatus, Retailer } from '@/lib/types';
import { Badge, Button, PageHeader, Select } from '@/components/ui';
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

export default function AdminRetailersPage() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Retailer | null>(null);

  const list = useListQuery<Retailer>('/admin/retailers', queryKeys.admin.retailers);

  const decide = useMutation({
    mutationFn: (input: { id: string; decision: ApprovalStatus; reason?: string }) =>
      patch(`/admin/retailers/${input.id}/approval`, {
        decision: input.decision,
        reason: input.reason,
      }),
    onSuccess: (_data, variables) => {
      toast.success(`Medical shop ${variables.decision.toLowerCase().replace('_', ' ')}`);
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });

  const columns: Column<Retailer>[] = [
    {
      key: 'store',
      header: 'Medical shop',
      render: (retailer) => (
        <div>
          <p className="font-medium text-ink-900">{retailer.storeName}</p>
          <p className="text-xs text-ink-500">
            {retailer.code} · {retailer.ownerName ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideOnMobile: true,
      render: (retailer) => (
        <div className="text-xs">
          <p className="text-ink-700">{retailer.phone}</p>
          <p className="text-ink-500">{retailer.email ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      hideOnMobile: true,
      render: (retailer) => (
        <div className="text-xs">
          <p className="text-ink-700">{[retailer.city, retailer.state].filter(Boolean).join(', ') || '—'}</p>
          <p className="text-ink-500">
            {retailer.pincode ?? '—'}
            {retailer.latitude ? ' · mapped' : ' · no location'}
          </p>
        </div>
      ),
    },
    {
      key: 'compliance',
      header: 'GST / licence',
      hideOnMobile: true,
      render: (retailer) => (
        <div className="text-xs">
          <p className="text-ink-700">{retailer.gstNumber ?? 'No GSTIN'}</p>
          <p className="text-ink-500">{retailer.drugLicenseNumber ?? 'No drug licence'}</p>
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'Activity',
      hideOnMobile: true,
      render: (retailer) => (
        <div className="text-xs">
          <p className="text-ink-700">{retailer._count?.products ?? 0} products</p>
          <p className="text-ink-500">{retailer._count?.orders ?? 0} orders</p>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      hideOnMobile: true,
      render: (retailer) =>
        retailer.ratingCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm text-ink-700">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {Number(retailer.ratingAvg).toFixed(1)}
            <span className="text-xs text-ink-400">({retailer.ratingCount})</span>
          </span>
        ) : (
          <span className="text-xs text-ink-400">No reviews</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (retailer) => (
        <div className="space-y-1">
          <ApprovalBadge status={retailer.approvalStatus} />
          {retailer.isTemporarilyClosed ? <Badge tone="warning">Temporarily closed</Badge> : null}
        </div>
      ),
    },
    {
      key: 'registered',
      header: 'Registered',
      hideOnMobile: true,
      render: (retailer) => (
        <span className="text-xs text-ink-500">{formatDate(retailer.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (retailer) => (
        <div className="flex justify-end gap-2">
          <Link href={`/admin/retailers/${retailer.id}`}>
            <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}>
              View
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => setTarget(retailer)}>
            Review
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Medical shops"
        description="Approve stores before they become visible to customers on the marketplace."
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(retailer) => retailer.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="No medical shops found"
        emptyDescription="Adjust your filters, or wait for new registrations to arrive."
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by store, code, phone, GSTIN or pincode"
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
        title={`Review ${target?.storeName ?? ''}`}
        currentStatus={target?.approvalStatus}
        loading={decide.isPending}
        onClose={() => setTarget(null)}
        onSubmit={(decision, reason) => target && decide.mutate({ id: target.id, decision, reason })}
      />
    </>
  );
}
