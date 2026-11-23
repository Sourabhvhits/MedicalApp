'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { download, getOne } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, currency, number, todayISO } from '@/lib/utils';
import type { ReportResult } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  SkeletonRows,
} from '@/components/ui';

export interface ReportDefinition {
  /** Unique per entry — several entries can target the same endpoint key. */
  id: string;
  key: string;
  label: string;
  description: string;
  /** Column keys rendered in the on-screen table, in order. */
  columns: { key: string; header: string; numeric?: boolean }[];
  /** Extra query parameters, e.g. days for the expiry report. */
  extraParams?: Record<string, string | number>;
}

interface ReportsWorkspaceProps {
  title: string;
  description: string;
  basePath: string;
  scope: string;
  reports: ReportDefinition[];
}

const CURRENCY_HINTS = ['total', 'revenue', 'tax', 'taxable', 'value', 'paid', 'outstanding', 'cost', 'mrp', 'price'];

function isCurrencyKey(key: string): boolean {
  const lower = key.toLowerCase();
  return CURRENCY_HINTS.some((hint) => lower.includes(hint));
}

/**
 * Shared reporting surface for admin, vendor and retailer. Filters are applied
 * to the on-screen table and carried into every export, so a downloaded file
 * always matches what was displayed.
 */
export function ReportsWorkspace({
  title,
  description,
  basePath,
  scope,
  reports,
}: ReportsWorkspaceProps) {
  const [active, setActive] = useState(reports[0]);
  const [dateFrom, setDateFrom] = useState(todayISO(-29));
  const [dateTo, setDateTo] = useState(todayISO());
  const [exporting, setExporting] = useState<string | null>(null);

  const params = {
    dateFrom,
    dateTo,
    ...(active.extraParams ?? {}),
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.reports.run(scope, active.id, params),
    queryFn: () => getOne<ReportResult>(`${basePath}/${active.key}`, params),
  });

  const runExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setExporting(format);
    try {
      await download(
        `${basePath}/${active.key}`,
        { ...params, format },
        `${active.key}.${format === 'excel' ? 'xlsx' : format}`,
      );
      toast.success(`${active.label} exported`);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {};

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={<FileText className="h-4 w-4" />}
              loading={exporting === 'csv'}
              onClick={() => void runExport('csv')}
            >
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="h-4 w-4" />}
              loading={exporting === 'excel'}
              onClick={() => void runExport('excel')}
            >
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              loading={exporting === 'pdf'}
              onClick={() => void runExport('pdf')}
            >
              PDF
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <nav className="lg:col-span-1">
          <Card padded={false} className="overflow-hidden">
            <ul>
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => setActive(report)}
                    className={cn(
                      'w-full border-b border-ink-100 px-4 py-3 text-left transition-colors last:border-0',
                      active.id === report.id
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-ink-700 hover:bg-ink-50',
                    )}
                  >
                    <span className="block text-sm font-medium">{report.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-500">{report.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </nav>

        <div className="space-y-4 lg:col-span-3">
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="From"
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-44"
              />
              <Input
                label="To"
                type="date"
                value={dateTo}
                min={dateFrom}
                max={todayISO()}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-44"
              />
              <Select
                label="Quick range"
                className="w-44"
                value=""
                onChange={(event) => {
                  const days = Number(event.target.value);
                  if (!days) return;
                  setDateFrom(todayISO(-(days - 1)));
                  setDateTo(todayISO());
                }}
                options={[
                  { value: '', label: 'Custom' },
                  { value: '7', label: 'Last 7 days' },
                  { value: '30', label: 'Last 30 days' },
                  { value: '90', label: 'Last 90 days' },
                  { value: '365', label: 'Last 12 months' },
                ]}
              />
              <Button
                variant="outline"
                icon={<RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />}
                onClick={() => void refetch()}
              >
                Refresh
              </Button>
            </div>
          </Card>

          <Card padded={false} className="overflow-hidden">
            <header className="border-b border-ink-200 px-5 py-4">
              <h2 className="text-base font-semibold text-ink-900">{active.label}</h2>
              <p className="mt-0.5 text-sm text-ink-500">{active.description}</p>
            </header>

            {isLoading ? (
              <SkeletonRows columns={Math.min(active.columns.length, 6)} />
            ) : error ? (
              <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="No data for this period"
                description="Try a wider date range, or check back once there is activity."
              />
            ) : (
              <>
                <div className="scroll-thin max-h-[60vh] overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-ink-50">
                      <tr className="border-b border-ink-200">
                        {active.columns.map((column) => (
                          <th
                            key={column.key}
                            className={cn(
                              'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500',
                              column.numeric ? 'text-right' : 'text-left',
                            )}
                          >
                            {column.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={index} className="border-b border-ink-100 last:border-0">
                          {active.columns.map((column) => {
                            const value = row[column.key];
                            return (
                              <td
                                key={column.key}
                                className={cn(
                                  'px-4 py-2.5 text-ink-700',
                                  column.numeric && 'text-right tabular-nums',
                                )}
                              >
                                {column.numeric
                                  ? isCurrencyKey(column.key)
                                    ? currency(value as number)
                                    : number(value as number)
                                  : String(value ?? '—')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <footer className="flex flex-wrap gap-x-8 gap-y-2 border-t border-ink-200 bg-ink-50 px-5 py-3">
                  {Object.entries(totals).map(([key, value]) => (
                    <span key={key} className="text-sm">
                      <span className="text-ink-500">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}:
                      </span>{' '}
                      <span className="font-semibold text-ink-900">
                        {isCurrencyKey(key) ? currency(value as number) : number(value as number)}
                      </span>
                    </span>
                  ))}
                </footer>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export const SALES_REPORT: ReportDefinition = {
  id: 'sales',
  key: 'sales',
  label: 'Sales report',
  description: 'Customer orders with tax and totals',
  columns: [
    { key: 'orderNumber', header: 'Order' },
    { key: 'date', header: 'Date' },
    { key: 'store', header: 'Store' },
    { key: 'customer', header: 'Customer' },
    { key: 'status', header: 'Status' },
    { key: 'taxable', header: 'Taxable', numeric: true },
    { key: 'tax', header: 'GST', numeric: true },
    { key: 'total', header: 'Total', numeric: true },
  ],
};

export const SALES_BY_PRODUCT_REPORT: ReportDefinition = {
  id: 'sales-by-product',
  key: 'sales-by-product',
  label: 'Product-wise sales',
  description: 'Units sold and revenue per product',
  columns: [
    { key: 'product', header: 'Product' },
    { key: 'sku', header: 'SKU' },
    { key: 'category', header: 'Category' },
    { key: 'quantity', header: 'Qty sold', numeric: true },
    { key: 'revenue', header: 'Revenue', numeric: true },
    { key: 'tax', header: 'GST', numeric: true },
  ],
};

export const PURCHASE_REPORT: ReportDefinition = {
  id: 'purchases',
  key: 'purchases',
  label: 'Purchase report',
  description: 'Wholesale orders and outstanding amounts',
  columns: [
    { key: 'poNumber', header: 'PO' },
    { key: 'date', header: 'Date' },
    { key: 'vendor', header: 'Vendor' },
    { key: 'status', header: 'Status' },
    { key: 'taxable', header: 'Taxable', numeric: true },
    { key: 'tax', header: 'GST', numeric: true },
    { key: 'total', header: 'Total', numeric: true },
    { key: 'outstanding', header: 'Outstanding', numeric: true },
  ],
};

export const STOCK_REPORT: ReportDefinition = {
  id: 'stock',
  key: 'stock',
  label: 'Batch-wise stock',
  description: 'Every batch with expiry and valuation',
  columns: [
    { key: 'product', header: 'Product' },
    { key: 'batchNumber', header: 'Batch' },
    { key: 'expiryDate', header: 'Expiry' },
    { key: 'daysToExpiry', header: 'Days left', numeric: true },
    { key: 'quantity', header: 'Qty', numeric: true },
    { key: 'available', header: 'Available', numeric: true },
    { key: 'purchasePrice', header: 'Cost', numeric: true },
    { key: 'stockValue', header: 'Stock value', numeric: true },
  ],
};

export const STOCK_MOVEMENT_REPORT: ReportDefinition = {
  id: 'stock-movement',
  key: 'stock-movement',
  label: 'Stock movement',
  description: 'Every inventory transaction in the period',
  columns: [
    { key: 'date', header: 'Date' },
    { key: 'product', header: 'Product' },
    { key: 'batch', header: 'Batch' },
    { key: 'type', header: 'Type' },
    { key: 'direction', header: 'Direction' },
    { key: 'quantity', header: 'Qty', numeric: true },
    { key: 'balanceAfter', header: 'Balance', numeric: true },
    { key: 'reference', header: 'Reference' },
  ],
};

export const LOW_STOCK_REPORT: ReportDefinition = {
  id: 'low-stock',
  key: 'low-stock',
  label: 'Low stock',
  description: 'Products at or below their minimum level',
  columns: [
    { key: 'product', header: 'Product' },
    { key: 'sku', header: 'SKU' },
    { key: 'category', header: 'Category' },
    { key: 'available', header: 'Available', numeric: true },
    { key: 'minimum', header: 'Minimum', numeric: true },
    { key: 'shortfall', header: 'Shortfall', numeric: true },
    { key: 'status', header: 'Status' },
  ],
};

export const expiryReport = (days: number, label: string): ReportDefinition => ({
  id: `expiry-${days}`,
  key: 'expiry',
  label,
  description: days === 0 ? 'Batches already past expiry' : `Batches expiring within ${days} days`,
  extraParams: { days },
  columns: [
    { key: 'product', header: 'Product' },
    { key: 'batchNumber', header: 'Batch' },
    { key: 'expiryDate', header: 'Expiry' },
    { key: 'daysToExpiry', header: 'Days left', numeric: true },
    { key: 'quantity', header: 'Qty', numeric: true },
    { key: 'valueAtRisk', header: 'Value at risk', numeric: true },
  ],
});
