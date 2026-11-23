'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, X } from 'lucide-react';
import { download, getOne } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue, useListQuery } from '@/hooks/use-list';
import { formatDateTime, humanize, todayISO } from '@/lib/utils';
import { Badge, Button, Input, Modal, PageHeader, Select } from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';

interface AuditLog {
  id: string;
  action: string;
  module: string;
  recordId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
  userType: string | null;
  user: { id: string; firstName: string; lastName: string | null; email: string | null } | null;
}

const MODULES = [
  'auth',
  'user',
  'vendor',
  'retailer',
  'product',
  'catalog',
  'inventory',
  'order',
  'purchase',
  'finance',
  'setting',
];

export default function AdminAuditLogsPage() {
  const [inspecting, setInspecting] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);
  const [userLabel, setUserLabel] = useState('');
  const list = useListQuery<AuditLog>('/admin/audit-logs', queryKeys.admin.auditLogs);

  const exportLogs = async () => {
    setExporting(true);
    try {
      await download(
        '/admin/audit-logs/export',
        { ...list.filters, search: list.search || undefined, format: 'csv' },
        'audit-log.csv',
      );
    } catch {
      toast.error('Could not export the audit log');
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<AuditLog>[] = [
    {
      key: 'time',
      header: 'When',
      render: (log) => <span className="text-xs text-ink-600">{formatDateTime(log.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: 'Who',
      render: (log) => (
        <div>
          <p className="text-sm text-ink-800">
            {log.user ? `${log.user.firstName} ${log.user.lastName ?? ''}`.trim() : 'System'}
          </p>
          <p className="text-xs text-ink-500">{log.user?.email ?? humanize(log.userType)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (log) => <span className="font-mono text-xs text-ink-700">{log.action}</span>,
    },
    {
      key: 'module',
      header: 'Module',
      render: (log) => <Badge tone="neutral">{log.module}</Badge>,
    },
    {
      key: 'record',
      header: 'Record',
      hideOnMobile: true,
      render: (log) => (
        <span className="font-mono text-[11px] text-ink-500">
          {log.recordId ? `${log.recordId.slice(0, 8)}...` : '—'}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      hideOnMobile: true,
      render: (log) => <span className="font-mono text-xs text-ink-500">{log.ipAddress ?? '—'}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every approval, price change, stock adjustment and status change, with before and after values."
        action={
          <Button variant="outline" icon={<Download className="h-4 w-4" />} loading={exporting} onClick={exportLogs}>
            Export CSV
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(log) => log.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        onRowClick={setInspecting}
        emptyTitle="No audit entries"
        emptyDescription="Actions performed on the platform will be recorded here."
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by action"
              className="w-full sm:w-64"
            />
            <Select
              aria-label="Module"
              value={(list.filters.module as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('module', event.target.value)}
              className="w-44"
            >
              <option value="ALL">All modules</option>
              {MODULES.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              aria-label="From date"
              max={todayISO()}
              value={(list.filters.dateFrom as string) ?? ''}
              onChange={(event) => list.setFilter('dateFrom', event.target.value || undefined)}
              className="w-40"
            />
            <Input
              type="date"
              aria-label="To date"
              max={todayISO()}
              value={(list.filters.dateTo as string) ?? ''}
              onChange={(event) => list.setFilter('dateTo', event.target.value || undefined)}
              className="w-40"
            />
            <UserFilter
              label={userLabel}
              onSelect={(user) => {
                list.setFilter('userId', user?.id);
                setUserLabel(user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : '');
              }}
            />
          </FilterBar>
        }
      />

      <Modal
        open={Boolean(inspecting)}
        onClose={() => setInspecting(null)}
        title={inspecting?.action ?? ''}
        description={inspecting ? formatDateTime(inspecting.createdAt) : undefined}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Before</h3>
            <pre className="scroll-thin max-h-72 overflow-auto rounded-lg bg-ink-900 p-3 font-mono text-[11px] text-ink-100">
              {JSON.stringify(inspecting?.oldValue ?? null, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">After</h3>
            <pre className="scroll-thin max-h-72 overflow-auto rounded-lg bg-ink-900 p-3 font-mono text-[11px] text-ink-100">
              {JSON.stringify(inspecting?.newValue ?? null, null, 2)}
            </pre>
          </div>
        </div>
      </Modal>
    </>
  );
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
}

/** Type-to-search user picker — the audit-log user filter needs a real `userId`, not free text. */
function UserFilter({ label, onSelect }: { label: string; onSelect: (user: UserOption | null) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 300);

  const { data } = useQuery({
    queryKey: ['admin', 'user-filter', debounced],
    queryFn: () => getOne<UserOption[]>('/admin/users', { search: debounced, limit: 6 }),
    enabled: open && debounced.trim().length >= 2,
  });

  return (
    <div className="relative w-full sm:w-56">
      {label ? (
        <div className="flex items-center gap-1 rounded-lg border border-ink-300 bg-white py-2 pl-3 pr-2 text-sm">
          <span className="flex-1 truncate text-ink-800">{label}</span>
          <button
            type="button"
            aria-label="Clear user filter"
            onClick={() => {
              onSelect(null);
              setQuery('');
            }}
            className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Filter by user"
        />
      )}

      {open && !label && data && data.length > 0 ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg">
          {data.map((user) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(user);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-ink-50"
            >
              <span className="font-medium text-ink-900">
                {user.firstName} {user.lastName ?? ''}
              </span>
              <span className="text-xs text-ink-500">{user.email}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
