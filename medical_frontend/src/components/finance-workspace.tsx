'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Landmark,
  Plus,
  Receipt,
  Repeat,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { ApiError, del, download, getOne, patch, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { cn, currency, formatDate, humanize, percent, todayISO } from '@/lib/utils';
import type { FinanceSummary } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonRows,
  Textarea,
} from '@/components/ui';
import { DataTable, FilterBar, type Column } from '@/components/ui/data-table';
import { StatCard } from '@/components/charts';

type Scope = 'vendor' | 'retailer';
type View = 'overview' | 'ledger' | 'expenses' | 'payments' | 'gst';

interface FinanceTxn {
  id: string;
  type: string;
  direction: 'IN' | 'OUT';
  amount: string;
  taxAmount: string;
  partyName: string | null;
  description: string | null;
  txnDate: string;
  referenceType: string | null;
}

interface Expense {
  id: string;
  category: string;
  title: string;
  amount: string;
  taxAmount: string;
  expenseDate: string;
  paymentMode: string;
  notes: string | null;
  status: 'PENDING' | 'PAID';
  isRecurring: boolean;
  recurrenceInterval: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null;
  recurrenceCancelledAt: string | null;
  parentExpenseId: string | null;
}

interface Payment {
  id: string;
  paymentNumber: string;
  direction: 'IN' | 'OUT';
  mode: string;
  amount: string;
  referenceNo: string | null;
  paidAt: string;
  notes: string | null;
  purchaseOrder?: { poNumber: string } | null;
  order?: { orderNumber: string } | null;
}

interface GstReport {
  period: { from: string; to: string };
  outward: {
    invoices: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
    totalAmount: number;
  };
  inward: GstReport['outward'];
  netPayable: number;
  rateWise: { gstRate: number; taxableAmount: number; taxAmount: number }[];
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'payments', label: 'Payments' },
  { key: 'gst', label: 'GST' },
];

const EXPENSE_CATEGORIES = [
  'Rent',
  'Salaries',
  'Electricity',
  'Transport',
  'Packaging',
  'Marketing',
  'Maintenance',
  'Professional fees',
  'Other',
];

/** Finance surface shared by vendors and medical shops. */
export function FinanceWorkspace({ scope, basePath }: { scope: Scope; basePath: string }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('overview');
  const [dateFrom, setDateFrom] = useState(todayISO(-29));
  const [dateTo, setDateTo] = useState(todayISO());
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [exportingFiling, setExportingFiling] = useState<'gstr1' | 'gstr3b' | null>(null);

  const period = { dateFrom, dateTo };

  const exportFiling = async (report: 'gstr1' | 'gstr3b') => {
    setExportingFiling(report);
    try {
      await download(`${basePath}/gst/${report}/export`, { ...period, format: 'excel' }, `${report}.xlsx`);
      toast.success(`${report.toUpperCase()} exported`);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExportingFiling(null);
    }
  };

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: queryKeys.finance.summary(scope, period),
    queryFn: () => getOne<FinanceSummary>(`${basePath}/summary`, period),
  });

  const { data: gst } = useQuery({
    queryKey: queryKeys.finance.gst(scope, period),
    queryFn: () => getOne<GstReport>(`${basePath}/gst`, period),
    enabled: view === 'gst',
  });

  const ledger = useListQuery<FinanceTxn>(
    `${basePath}/transactions`,
    (params) => queryKeys.finance.transactions(scope, params),
    { initialFilters: period, enabled: view === 'ledger' },
  );

  const expenses = useListQuery<Expense>(
    `${basePath}/expenses`,
    (params) => queryKeys.finance.expenses(scope, params),
    { initialFilters: period, enabled: view === 'expenses' },
  );

  const payments = useListQuery<Payment>(
    `${basePath}/payments`,
    (params) => queryKeys.finance.payments(scope, params),
    { initialFilters: period, enabled: view === 'payments' },
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
  };

  const removeExpense = useMutation({
    mutationFn: (id: string) => del(`${basePath}/expenses/${id}`),
    onSuccess: () => {
      toast.success('Expense deleted');
      setDeletingExpense(null);
      invalidate();
    },
  });

  const markExpensePaid = useMutation({
    mutationFn: (id: string) => patch(`${basePath}/expenses/${id}/mark-paid`),
    onSuccess: () => {
      toast.success('Expense marked as paid');
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not update the expense'),
  });

  const cancelRecurrence = useMutation({
    mutationFn: (id: string) => patch(`${basePath}/expenses/${id}/cancel-recurrence`),
    onSuccess: () => {
      toast.success('Recurrence cancelled — this was the last automatic occurrence');
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not cancel the recurrence'),
  });

  const ledgerColumns: Column<FinanceTxn>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (txn) => <span className="text-xs text-ink-600">{formatDate(txn.txnDate)}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (txn) => <Badge tone="neutral">{humanize(txn.type)}</Badge>,
    },
    {
      key: 'party',
      header: 'Party',
      render: (txn) => (
        <div>
          <p className="text-sm text-ink-800">{txn.partyName ?? '—'}</p>
          <p className="text-xs text-ink-500">{txn.description ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (txn) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-sm font-medium tabular-nums',
            txn.direction === 'IN' ? 'text-success' : 'text-danger',
          )}
        >
          {txn.direction === 'IN' ? (
            <ArrowDownLeft className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5" />
          )}
          {currency(txn.amount)}
        </span>
      ),
    },
  ];

  const expenseColumns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (expense) => <span className="text-xs text-ink-600">{formatDate(expense.expenseDate)}</span>,
    },
    {
      key: 'title',
      header: 'Expense',
      render: (expense) => (
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
            {expense.title}
            {expense.isRecurring && !expense.recurrenceCancelledAt ? (
              <Repeat className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-label="Recurring" />
            ) : null}
          </p>
          <p className="text-xs text-ink-500">{expense.notes ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (expense) => <Badge tone="neutral">{expense.category}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (expense) => (
        <Badge tone={expense.status === 'PAID' ? 'success' : 'warning'}>{humanize(expense.status)}</Badge>
      ),
    },
    {
      key: 'mode',
      header: 'Paid by',
      hideOnMobile: true,
      render: (expense) => <span className="text-xs text-ink-600">{humanize(expense.paymentMode)}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (expense) => (
        <span className="text-sm font-medium tabular-nums text-ink-900">{currency(expense.amount)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (expense) => (
        <div className="flex flex-wrap justify-end gap-2">
          {expense.status === 'PENDING' ? (
            <Button
              variant="ghost"
              size="sm"
              loading={markExpensePaid.isPending}
              onClick={() => markExpensePaid.mutate(expense.id)}
            >
              Mark paid
            </Button>
          ) : null}
          {expense.isRecurring && !expense.recurrenceCancelledAt ? (
            <Button
              variant="ghost"
              size="sm"
              loading={cancelRecurrence.isPending}
              onClick={() => cancelRecurrence.mutate(expense.id)}
            >
              Cancel recurrence
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setDeletingExpense(expense)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'number',
      header: 'Payment',
      render: (payment) => (
        <div>
          <p className="font-mono text-xs font-medium text-ink-800">{payment.paymentNumber}</p>
          <p className="text-xs text-ink-500">{formatDate(payment.paidAt)}</p>
        </div>
      ),
    },
    {
      key: 'against',
      header: 'Against',
      render: (payment) => (
        <span className="text-sm text-ink-700">
          {payment.purchaseOrder?.poNumber ?? payment.order?.orderNumber ?? 'Manual entry'}
        </span>
      ),
    },
    {
      key: 'mode',
      header: 'Mode',
      hideOnMobile: true,
      render: (payment) => (
        <div className="text-xs">
          <p className="text-ink-700">{humanize(payment.mode)}</p>
          <p className="text-ink-500">{payment.referenceNo ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (payment) => (
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            payment.direction === 'IN' ? 'text-success' : 'text-danger',
          )}
        >
          {payment.direction === 'IN' ? '+' : '−'}
          {currency(payment.amount)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Finance"
        description="Sales, purchases, expenses, payments and GST for your business."
        action={
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="From"
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-40"
            />
            <Input
              label="To"
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayISO()}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-40"
            />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setExpenseOpen(true)}>
              Add expense
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              view === item.key
                ? 'bg-brand-700 text-white'
                : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === 'overview' ? (
        loadingSummary || !summary ? (
          <SkeletonRows rows={3} columns={4} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Revenue"
                value={currency(summary.profitAndLoss.revenue)}
                hint={`${summary.sales.count} sale(s)`}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="success"
              />
              <StatCard
                label="Net profit"
                value={currency(summary.profitAndLoss.netProfit)}
                hint={`${percent(summary.profitAndLoss.marginPct)} margin`}
                icon={<Landmark className="h-5 w-5" />}
                tone={summary.profitAndLoss.netProfit >= 0 ? 'success' : 'danger'}
              />
              <StatCard
                label="Receivables"
                value={currency(summary.receivables)}
                hint="Owed to you"
                icon={<ArrowDownLeft className="h-5 w-5" />}
                tone="info"
              />
              <StatCard
                label="Payables"
                value={currency(summary.payables)}
                hint="You owe suppliers"
                icon={<Wallet className="h-5 w-5" />}
                tone="warning"
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title="Profit and loss"
                  description={`${formatDate(summary.period.from)} to ${formatDate(summary.period.to)}`}
                />
                <dl className="divide-y divide-ink-100 text-sm">
                  <Row label="Revenue" value={summary.profitAndLoss.revenue} />
                  <Row label="Cost of goods sold" value={-summary.profitAndLoss.costOfGoodsSold} />
                  <Row label="Gross profit" value={summary.profitAndLoss.grossProfit} bold />
                  <Row label="Operating expenses" value={-summary.profitAndLoss.expenses} />
                  <Row label="Net profit" value={summary.profitAndLoss.netProfit} bold emphasis />
                </dl>
              </Card>

              <Card>
                <CardHeader title="Cash movement" />
                <dl className="divide-y divide-ink-100 text-sm">
                  <Row label="Payments received" value={summary.payments.received} />
                  <Row label="Payments made" value={-summary.payments.paid} />
                  <Row label="Purchases" value={-summary.purchases.amount} />
                  <Row label="Sales returns" value={-summary.sales.returns} />
                  <Row label="Purchase returns" value={summary.purchases.returns} />
                </dl>
              </Card>
            </div>
          </>
        )
      ) : null}

      {view === 'ledger' ? (
        <DataTable
          columns={ledgerColumns}
          rows={ledger.rows}
          rowKey={(txn) => txn.id}
          loading={ledger.isLoading}
          error={ledger.error}
          meta={ledger.meta}
          onPageChange={ledger.setPage}
          emptyTitle="No transactions in this period"
          toolbar={
            <FilterBar>
              <Select
                aria-label="Transaction type"
                value={(ledger.filters.type as string) ?? 'ALL'}
                onChange={(event) => ledger.setFilter('type', event.target.value)}
                className="w-48"
                options={[
                  { value: 'ALL', label: 'All types' },
                  { value: 'SALE', label: 'Sales' },
                  { value: 'PURCHASE', label: 'Purchases' },
                  { value: 'PAYMENT_IN', label: 'Payments in' },
                  { value: 'PAYMENT_OUT', label: 'Payments out' },
                  { value: 'EXPENSE', label: 'Expenses' },
                  { value: 'SALE_RETURN', label: 'Sales returns' },
                  { value: 'PURCHASE_RETURN', label: 'Purchase returns' },
                ]}
              />
            </FilterBar>
          }
        />
      ) : null}

      {view === 'expenses' ? (
        <DataTable
          columns={expenseColumns}
          rows={expenses.rows}
          rowKey={(expense) => expense.id}
          loading={expenses.isLoading}
          error={expenses.error}
          meta={expenses.meta}
          onPageChange={expenses.setPage}
          emptyTitle="No expenses recorded"
          emptyDescription="Track rent, salaries and running costs so your profit figure is real."
          emptyAction={<Button onClick={() => setExpenseOpen(true)}>Add expense</Button>}
          toolbar={
            <FilterBar>
              <Select
                aria-label="Status"
                value={(expenses.filters.status as string) ?? 'ALL'}
                onChange={(event) => expenses.setFilter('status', event.target.value)}
                className="w-44"
                options={[
                  { value: 'ALL', label: 'All status' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'PAID', label: 'Paid' },
                ]}
              />
            </FilterBar>
          }
        />
      ) : null}

      {view === 'payments' ? (
        <DataTable
          columns={paymentColumns}
          rows={payments.rows}
          rowKey={(payment) => payment.id}
          loading={payments.isLoading}
          error={payments.error}
          meta={payments.meta}
          onPageChange={payments.setPage}
          emptyTitle="No payments in this period"
          toolbar={
            <FilterBar>
              <Select
                aria-label="Direction"
                value={(payments.filters.direction as string) ?? 'ALL'}
                onChange={(event) => payments.setFilter('direction', event.target.value)}
                className="w-44"
                options={[
                  { value: 'ALL', label: 'All payments' },
                  { value: 'IN', label: 'Received' },
                  { value: 'OUT', label: 'Paid' },
                ]}
              />
            </FilterBar>
          }
        />
      ) : null}

      {view === 'gst' && gst ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              loading={exportingFiling === 'gstr1'}
              onClick={() => void exportFiling('gstr1')}
            >
              Export GSTR-1
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              loading={exportingFiling === 'gstr3b'}
              onClick={() => void exportFiling('gstr3b')}
            >
              Export GSTR-3B
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Outward supplies" description="GST you collected on sales" />
            <dl className="divide-y divide-ink-100 text-sm">
              <Row label="Taxable value" value={gst.outward.taxableAmount} />
              <Row label="CGST" value={gst.outward.cgstAmount} />
              <Row label="SGST" value={gst.outward.sgstAmount} />
              <Row label="IGST" value={gst.outward.igstAmount} />
              <Row label="Total GST" value={gst.outward.totalTax} bold />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Inward supplies" description="GST you paid on purchases" />
            <dl className="divide-y divide-ink-100 text-sm">
              <Row label="Taxable value" value={gst.inward.taxableAmount} />
              <Row label="CGST" value={gst.inward.cgstAmount} />
              <Row label="SGST" value={gst.inward.sgstAmount} />
              <Row label="IGST" value={gst.inward.igstAmount} />
              <Row label="Total GST" value={gst.inward.totalTax} bold />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Net position" description="Output tax less input credit" />
            <p
              className={cn(
                'text-3xl font-semibold',
                gst.netPayable >= 0 ? 'text-danger' : 'text-success',
              )}
            >
              {currency(Math.abs(gst.netPayable))}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {gst.netPayable >= 0 ? 'Payable to the government' : 'Input credit carried forward'}
            </p>

            {gst.rateWise.length > 0 ? (
              <>
                <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Rate-wise breakup
                </h3>
                <ul className="divide-y divide-ink-100 text-sm">
                  {gst.rateWise.map((row) => (
                    <li key={row.gstRate} className="flex justify-between py-2">
                      <span className="text-ink-600">{row.gstRate}%</span>
                      <span className="tabular-nums">
                        {currency(row.taxableAmount)}{' '}
                        <span className="text-ink-400">→ {currency(row.taxAmount)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
              <Receipt className="mr-1 inline h-3.5 w-3.5" />
              This is an operational summary. Confirm figures with your accountant before filing.
            </p>
          </Card>
          </div>
        </>
      ) : null}

      <ExpenseModal
        open={expenseOpen}
        basePath={basePath}
        onClose={() => setExpenseOpen(false)}
        onSaved={invalidate}
      />

      <ConfirmDialog
        open={Boolean(deletingExpense)}
        onClose={() => setDeletingExpense(null)}
        onConfirm={() => deletingExpense && removeExpense.mutate(deletingExpense.id)}
        title="Delete expense"
        message={`"${deletingExpense?.title}" will be removed from your books and the ledger.`}
        confirmLabel="Delete"
        loading={removeExpense.isPending}
      />
    </>
  );
}

function Row({
  label,
  value,
  bold,
  emphasis,
}: {
  label: string;
  value: number;
  bold?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className={cn('text-ink-600', bold && 'font-medium text-ink-800')}>{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          bold && 'font-semibold',
          emphasis && (value >= 0 ? 'text-success' : 'text-danger'),
        )}
      >
        {currency(value)}
      </dd>
    </div>
  );
}

function ExpenseModal({
  open,
  basePath,
  onClose,
  onSaved,
}: {
  open: boolean;
  basePath: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    title: '',
    amount: '',
    taxAmount: '0',
    expenseDate: todayISO(),
    paymentMode: 'CASH',
    notes: '',
    isRecurring: false,
    recurrenceInterval: 'MONTHLY',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      post(`${basePath}/expenses`, {
        ...form,
        amount: Number(form.amount),
        taxAmount: Number(form.taxAmount || 0),
        recurrenceInterval: form.isRecurring ? form.recurrenceInterval : undefined,
      }),
    onSuccess: () => {
      toast.success('Expense recorded');
      setForm((current) => ({ ...current, title: '', amount: '', notes: '', isRecurring: false }));
      setErrors({});
      onSaved();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fieldErrors);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an expense"
      description="Expenses reduce your net profit and appear in the ledger."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => {
              if (!form.title.trim() || !form.amount) {
                toast.error('Enter a title and amount');
                return;
              }
              save.mutate();
            }}
          >
            Save expense
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Title"
          required
          className="sm:col-span-2"
          placeholder="Shop rent for September"
          value={form.title}
          error={errors.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
        <Select
          label="Category"
          value={form.category}
          onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          options={EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category }))}
        />
        <Input
          label="Date"
          type="date"
          max={todayISO()}
          value={form.expenseDate}
          onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))}
        />
        <Input
          label="Amount"
          type="number"
          step="0.01"
          required
          value={form.amount}
          error={errors.amount}
          onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
        />
        <Input
          label="GST included"
          type="number"
          step="0.01"
          value={form.taxAmount}
          onChange={(event) => setForm((current) => ({ ...current, taxAmount: event.target.value }))}
        />
        <Select
          label="Paid by"
          value={form.paymentMode}
          onChange={(event) => setForm((current) => ({ ...current, paymentMode: event.target.value }))}
          options={[
            { value: 'CASH', label: 'Cash' },
            { value: 'UPI', label: 'UPI' },
            { value: 'CARD', label: 'Card' },
            { value: 'NET_BANKING', label: 'Net banking' },
            { value: 'CHEQUE', label: 'Cheque' },
            { value: 'BANK_TRANSFER', label: 'Bank transfer' },
          ]}
        />
        <Textarea
          label="Notes"
          className="sm:col-span-2"
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />

        <div className="sm:col-span-2">
          <Checkbox
            label="This is a recurring expense (e.g. rent, subscription)"
            checked={form.isRecurring}
            onChange={(event) => setForm((current) => ({ ...current, isRecurring: event.target.checked }))}
          />
        </div>
        {form.isRecurring ? (
          <Select
            label="Repeats"
            value={form.recurrenceInterval}
            onChange={(event) => setForm((current) => ({ ...current, recurrenceInterval: event.target.value }))}
            options={[
              { value: 'WEEKLY', label: 'Every week' },
              { value: 'MONTHLY', label: 'Every month' },
              { value: 'YEARLY', label: 'Every year' },
            ]}
            hint="This expense will be recorded now; the next occurrence is auto-created as Pending when it's due."
          />
        ) : null}
      </div>
    </Modal>
  );
}
