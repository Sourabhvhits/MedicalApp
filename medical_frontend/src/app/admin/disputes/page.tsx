'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, getOne, patch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { formatDateTime, humanize } from '@/lib/utils';
import type { Dispute } from '@/lib/types';
import { Badge, Button, LoadingBlock, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';

function DisputeStatusBadge({ status }: { status: Dispute['status'] }) {
  const tone =
    status === 'RESOLVED' ? 'success' : status === 'REJECTED' ? 'danger' : status === 'UNDER_REVIEW' ? 'info' : 'warning';
  return <Badge tone={tone}>{humanize(status)}</Badge>;
}

export default function AdminDisputesPage() {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [decision, setDecision] = useState<'RESOLVED' | 'REJECTED'>('RESOLVED');
  const [resolution, setResolution] = useState('');

  const list = useListQuery<Dispute>('/admin/disputes', queryKeys.admin.disputes);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: queryKeys.admin.dispute(openId ?? ''),
    queryFn: () => getOne<Dispute>(`/admin/disputes/${openId}`),
    enabled: Boolean(openId),
  });

  const resolve = useMutation({
    mutationFn: (input: { id: string; status: 'RESOLVED' | 'REJECTED'; resolution: string }) =>
      patch(`/admin/disputes/${input.id}/resolve`, { status: input.status, resolution: input.resolution }),
    onSuccess: (_data, variables) => {
      toast.success(variables.status === 'RESOLVED' ? 'Issue marked resolved' : 'Issue rejected');
      setResolution('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.disputes({}) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dispute(variables.id) });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the resolution');
    },
  });

  const columns: Column<Dispute>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (dispute) => (
        <div>
          <p className="font-mono text-sm font-medium text-ink-900">{dispute.order.orderNumber}</p>
          <p className="text-xs text-ink-500">{dispute.order.retailer.storeName}</p>
        </div>
      ),
    },
    {
      key: 'raisedBy',
      header: 'Raised by',
      hideOnMobile: true,
      render: (dispute) => (
        <div>
          <p className="text-sm text-ink-800">{humanize(dispute.raisedByRole)}</p>
          <p className="text-xs text-ink-500">{formatDateTime(dispute.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (dispute) => <p className="max-w-sm truncate text-sm text-ink-700">{dispute.reason}</p>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (dispute) => <DisputeStatusBadge status={dispute.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (dispute) => (
        <Button variant="ghost" size="sm" onClick={() => setOpenId(dispute.id)}>
          {dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW' ? 'Review' : 'View'}
        </Button>
      ),
    },
  ];

  const canResolve = detail && (detail.status === 'OPEN' || detail.status === 'UNDER_REVIEW');

  return (
    <>
      <PageHeader
        title="Disputes"
        description="Issues raised by customers or stores on a completed order — review and resolve."
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(dispute) => dispute.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="No issues raised"
        emptyDescription="Issues customers or stores raise on completed orders will appear here."
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by order number"
              className="w-full sm:w-64"
            />
            <Select
              aria-label="Status"
              value={(list.filters.status as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('status', event.target.value)}
              className="w-48"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'OPEN', label: 'Open' },
                { value: 'UNDER_REVIEW', label: 'Under review' },
                { value: 'RESOLVED', label: 'Resolved' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
            />
          </FilterBar>
        }
      />

      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={detail?.order.orderNumber ?? 'Issue'}
        description={detail ? `${detail.order.retailer.storeName} · raised by ${humanize(detail.raisedByRole).toLowerCase()}` : undefined}
        size="md"
        footer={
          canResolve ? (
            <>
              <Button variant="outline" onClick={() => setOpenId(null)}>
                Close
              </Button>
              <Button
                variant="danger"
                loading={resolve.isPending && decision === 'REJECTED'}
                onClick={() => {
                  if (resolution.trim().length < 3) {
                    toast.error('Add a short resolution note');
                    return;
                  }
                  setDecision('REJECTED');
                  resolve.mutate({ id: detail!.id, status: 'REJECTED', resolution: resolution.trim() });
                }}
              >
                Reject
              </Button>
              <Button
                loading={resolve.isPending && decision === 'RESOLVED'}
                onClick={() => {
                  if (resolution.trim().length < 3) {
                    toast.error('Add a short resolution note');
                    return;
                  }
                  setDecision('RESOLVED');
                  resolve.mutate({ id: detail!.id, status: 'RESOLVED', resolution: resolution.trim() });
                }}
              >
                Mark resolved
              </Button>
            </>
          ) : undefined
        }
      >
        {loadingDetail || !detail ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DisputeStatusBadge status={detail.status} />
              <span className="text-xs text-ink-500">{formatDateTime(detail.createdAt)}</span>
            </div>

            <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-800">{detail.reason}</p>

            {detail.resolution ? (
              <p className="rounded-lg bg-success-soft px-3 py-2.5 text-sm text-green-900">
                <span className="font-medium">Resolution:</span> {detail.resolution}
              </p>
            ) : canResolve ? (
              <Textarea
                label="Resolution note"
                required
                placeholder="What did you find, and what's being done about it (refund issued manually, replacement arranged, no fault found)…"
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
              />
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
