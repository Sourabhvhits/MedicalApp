'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { ApiError, getOne, put } from '@/lib/api-client';
import { currency } from '@/lib/utils';
import { Badge, Button, Input, LoadingBlock, Modal, PageHeader } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';

interface RetailerTerms {
  retailerId: string;
  storeName: string;
  city: string | null;
  creditLimit: number;
  paymentTermsDays: number;
  outstandingBalance: number;
}

export default function VendorRetailersPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RetailerTerms | null>(null);
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('');

  const queryKey = ['vendor', 'retailers', 'terms'];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getOne<RetailerTerms[]>('/vendor/retailers/terms'),
  });

  const save = useMutation({
    mutationFn: () =>
      put(`/vendor/retailers/${editing!.retailerId}/terms`, {
        creditLimit: Number(creditLimit) || 0,
        paymentTermsDays: Number(paymentTermsDays) || 0,
      }),
    onSuccess: () => {
      toast.success('Terms updated');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update terms');
    },
  });

  const openEdit = (row: RetailerTerms) => {
    setEditing(row);
    setCreditLimit(String(row.creditLimit));
    setPaymentTermsDays(String(row.paymentTermsDays));
  };

  const columns: Column<RetailerTerms>[] = [
    {
      key: 'store',
      header: 'Medical shop',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-ink-900">{row.storeName}</p>
          <p className="text-xs text-ink-500">{row.city ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      render: (row) => (
        <span className={row.outstandingBalance > 0 ? 'font-medium text-danger' : 'text-ink-500'}>
          {currency(row.outstandingBalance)}
        </span>
      ),
    },
    {
      key: 'creditLimit',
      header: 'Credit limit',
      render: (row) =>
        row.creditLimit > 0 ? (
          <span className="tabular-nums">{currency(row.creditLimit)}</span>
        ) : (
          <Badge tone="neutral">No limit</Badge>
        ),
    },
    {
      key: 'terms',
      header: 'Payment terms',
      hideOnMobile: true,
      render: (row) => (row.paymentTermsDays > 0 ? `Net ${row.paymentTermsDays} days` : <Badge tone="neutral">Due on receipt</Badge>),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Retailers"
        description="Credit limit and payment terms per medical shop that orders from you. A shop appears here once it has placed at least one order."
      />

      {isLoading ? (
        <LoadingBlock />
      ) : (
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(row) => row.retailerId}
          loading={false}
          emptyTitle="No retailers yet"
          emptyDescription="Once a medical shop places a purchase order with you, it will appear here."
        />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.storeName ?? 'Terms'}
        description="A credit limit of 0 means no limit; payment terms of 0 means due on receipt."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Credit limit (₹)"
            type="number"
            min="0"
            value={creditLimit}
            onChange={(event) => setCreditLimit(event.target.value)}
          />
          <Input
            label="Payment terms (days)"
            type="number"
            min="0"
            max="180"
            value={paymentTermsDays}
            onChange={(event) => setPaymentTermsDays(event.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
