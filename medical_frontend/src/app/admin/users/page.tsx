'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormik } from 'formik';
import { z } from 'zod';
import { toast } from 'sonner';
import { Laptop, Monitor, Plus, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
import { ApiError, del, getOne, patch, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { formatDate, humanize, relativeTime } from '@/lib/utils';
import { zodValidate } from '@/lib/zod-formik';
import { Badge, Button, Checkbox, EmptyState, Input, LoadingBlock, Modal, PageHeader, Select } from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';

interface UserSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  userType: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { role: { id: string; name: string; slug: string } }[];
}

interface Role {
  id: string;
  name: string;
  slug: string;
  scope: string;
}

const schema = z.object({
  firstName: z.string().trim().min(2, 'Enter a first name'),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/\d/, 'Include a number'),
});

type FormValues = z.infer<typeof schema>;

const STATUS_TONES: Record<string, 'success' | 'neutral' | 'danger' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUSPENDED: 'danger',
  PENDING_VERIFICATION: 'warning',
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [sessionsUser, setSessionsUser] = useState<AdminUser | null>(null);

  const list = useListQuery<AdminUser>('/admin/users', queryKeys.admin.users);

  const { data: roles } = useQuery({
    queryKey: queryKeys.admin.roles,
    queryFn: () => getOne<Role[]>('/admin/roles'),
  });

  const form = useFormik<FormValues>({
    initialValues: { firstName: '', lastName: '', email: '', phone: '', password: '' },
    validate: zodValidate(schema),
    onSubmit: (values) => {
      if (selectedRoles.length === 0) {
        toast.error('Assign at least one role');
        return;
      }
      create.mutate(values);
    },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) => post('/admin/users', { ...values, roleIds: selectedRoles }),
    onSuccess: () => {
      toast.success('Admin user created');
      setFormOpen(false);
      setSelectedRoles([]);
      form.resetForm();
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          form.setFieldError(field, message);
          form.setFieldTouched(field, true, false);
        });
      }
    },
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      patch(`/admin/users/${input.id}/status`, { status: input.status }),
    onSuccess: () => {
      toast.success('User status updated');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });

  const columns: Column<AdminUser>[] = [
    {
      key: 'user',
      header: 'User',
      render: (user) => (
        <div>
          <p className="font-medium text-ink-900">
            {user.firstName} {user.lastName ?? ''}
          </p>
          <p className="text-xs text-ink-500">{user.email ?? user.phone}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Account type',
      render: (user) => <Badge tone="brand">{humanize(user.userType)}</Badge>,
    },
    {
      key: 'roles',
      header: 'Roles',
      hideOnMobile: true,
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <span className="text-xs text-ink-400">No roles</span>
          ) : (
            user.roles.map((entry) => (
              <Badge key={entry.role.id} tone="neutral">
                {entry.role.name}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last sign-in',
      hideOnMobile: true,
      render: (user) => (
        <span className="text-xs text-ink-500">
          {user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Joined',
      hideOnMobile: true,
      render: (user) => <span className="text-xs text-ink-500">{formatDate(user.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => <Badge tone={STATUS_TONES[user.status] ?? 'neutral'}>{humanize(user.status)}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (user) => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Monitor className="h-4 w-4" />}
            onClick={() => setSessionsUser(user)}
          >
            Sessions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={
              user.status === 'ACTIVE' ? (
                <ShieldOff className="h-4 w-4 text-danger" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-success" />
              )
            }
            onClick={() =>
              setStatus.mutate({
                id: user.id,
                status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
              })
            }
          >
            {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with an account: platform staff, wholesalers, medical shops and customers."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
            Add admin user
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(user) => user.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="No users found"
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder="Search by name, email or phone"
              className="w-full sm:w-80"
            />
            <Select
              aria-label="Account type"
              value={(list.filters.userType as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('userType', event.target.value)}
              className="w-44"
              options={[
                { value: 'ALL', label: 'All types' },
                { value: 'SUPER_ADMIN', label: 'Super admin' },
                { value: 'ADMIN_STAFF', label: 'Admin staff' },
                { value: 'VENDOR', label: 'Wholesaler' },
                { value: 'RETAILER', label: 'Medical shop' },
                { value: 'CUSTOMER', label: 'Customer' },
              ]}
            />
            <Select
              aria-label="Status"
              value={(list.filters.status as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('status', event.target.value)}
              className="w-44"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
                { value: 'SUSPENDED', label: 'Suspended' },
                { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
              ]}
            />
          </FilterBar>
        }
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add admin staff user"
        description="Internal users who help run the platform. Assign only the roles they need."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={() => form.handleSubmit()}>
              Create user
            </Button>
          </>
        }
      >
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <Input
            label="First name"
            required
            error={form.touched.firstName ? form.errors.firstName : undefined}
            {...form.getFieldProps('firstName')}
          />
          <Input label="Last name" {...form.getFieldProps('lastName')} />
          <Input
            label="Email"
            type="email"
            required
            error={form.touched.email ? form.errors.email : undefined}
            {...form.getFieldProps('email')}
          />
          <Input
            label="Mobile number"
            required
            error={form.touched.phone ? form.errors.phone : undefined}
            {...form.getFieldProps('phone')}
          />
          <Input
            label="Temporary password"
            type="password"
            required
            className="sm:col-span-2"
            hint="8+ characters with upper, lower and a number"
            error={form.touched.password ? form.errors.password : undefined}
            {...form.getFieldProps('password')}
          />

          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-ink-700">Roles</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles
                ?.filter((role) => role.scope === 'ADMIN_STAFF' || role.scope === 'SUPER_ADMIN')
                .map((role) => (
                  <Checkbox
                    key={role.id}
                    label={role.name}
                    checked={selectedRoles.includes(role.id)}
                    onChange={(event) =>
                      setSelectedRoles((current) =>
                        event.target.checked
                          ? [...current, role.id]
                          : current.filter((id) => id !== role.id),
                      )
                    }
                  />
                ))}
            </div>
          </fieldset>
        </form>
      </Modal>

      <SessionsModal user={sessionsUser} onClose={() => setSessionsUser(null)} />
    </>
  );
}

function SessionsModal({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'user-sessions', user?.id] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getOne<UserSession[]>(`/admin/users/${user!.id}/sessions`),
    enabled: Boolean(user),
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) => del(`/admin/users/${user!.id}/sessions/${sessionId}`),
    onSuccess: () => {
      toast.success('Session revoked');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not revoke this session'),
  });

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={user ? `${user.firstName}'s active sessions` : 'Active sessions'}
      description="Every device currently signed in as this user. Revoking one signs it out immediately."
      size="md"
    >
      {isLoading || !data ? (
        <LoadingBlock />
      ) : data.length === 0 ? (
        <EmptyState icon={<Laptop className="h-8 w-8" />} title="No active sessions" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.map((session) => (
            <li key={session.id} className="flex items-center gap-3 py-3">
              <Laptop className="h-4 w-4 shrink-0 text-ink-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-800">{session.userAgent ?? 'Unknown device'}</p>
                <p className="text-xs text-ink-500">
                  {session.ipAddress ?? 'Unknown IP'} · signed in {relativeTime(session.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Revoke session"
                loading={revoke.isPending}
                onClick={() => revoke.mutate(session.id)}
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
