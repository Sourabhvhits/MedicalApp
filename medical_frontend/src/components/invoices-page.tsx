'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { getOne } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { currency, formatDate, humanize } from '@/lib/utils';
import { Button, LoadingBlock, Modal, PageHeader, Select } from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';
import { PaymentStatusBadge } from '@/components/ui/status';
import { InvoiceDocument, type InvoiceDocumentData } from '@/components/invoice-document';

interface Invoice extends InvoiceDocumentData {
  id: string;
  type: string;
  subtotal: string;
  discountAmount: string;
  paidAmount: string;
}

/** Invoice list plus a printable tax-invoice view, shared by both business roles. */
export function InvoicesPage({ scope, basePath }: { scope: string; basePath: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useListQuery<Invoice>(`${basePath}/invoices`, (params) =>
    queryKeys.finance.invoices(scope, params),
  );

  const { data: invoice, isLoading } = useQuery({
    queryKey: [...queryKeys.finance.invoices(scope, { id: openId }), 'detail'],
    queryFn: () => getOne<Invoice>(`${basePath}/invoices/${openId}`),
    enabled: Boolean(openId),
  });

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice',
      render: (row) => (
        <div>
          <p className="font-mono text-sm font-medium text-ink-900">{row.invoiceNumber}</p>
          <p className="text-xs text-ink-500">{formatDate(row.invoiceDate)}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <span className="text-sm text-ink-700">{humanize(row.type)}</span>,
    },
    {
      key: 'billTo',
      header: 'Billed to',
      render: (row) => (
        <div>
          <p className="text-sm text-ink-800">{row.billToName ?? '—'}</p>
          <p className="text-xs text-ink-500">
            {row.order?.orderNumber ?? row.purchaseOrder?.poNumber ?? ''}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (row) => (
        <div>
          <p className="text-sm font-medium tabular-nums text-ink-900">{currency(row.totalAmount)}</p>
          <p className="text-xs tabular-nums text-ink-500">{currency(row.paidAmount)} paid</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <PaymentStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setOpenId(row.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="GST invoices raised for every completed sale and dispatched wholesale order."
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(row) => row.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="No invoices yet"
        emptyDescription="Invoices are generated automatically when orders are fulfilled."
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by invoice number"
              className="w-full sm:w-72"
            />
            <Select
              aria-label="Type"
              value={(list.filters.type as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('type', event.target.value)}
              className="w-44"
              options={[
                { value: 'ALL', label: 'All types' },
                { value: 'SALES', label: 'Sales' },
                { value: 'PURCHASE', label: 'Purchase' },
              ]}
            />
            <Select
              aria-label="Status"
              value={(list.filters.status as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('status', event.target.value)}
              className="w-40"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'PENDING', label: 'Unpaid' },
                { value: 'PARTIAL', label: 'Part paid' },
                { value: 'PAID', label: 'Paid' },
              ]}
            />
          </FilterBar>
        }
      />

      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={invoice?.invoiceNumber ?? 'Invoice'}
        size="lg"
        footer={
          <Button
            icon={<Printer className="h-4 w-4" />}
            onClick={() => window.print()}
            className="no-print"
          >
            Print
          </Button>
        }
      >
        {isLoading || !invoice ? <LoadingBlock /> : <InvoiceDocument invoice={invoice} />}
      </Modal>
    </>
  );
}
