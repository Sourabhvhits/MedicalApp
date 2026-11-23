'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Plus, Save } from 'lucide-react';
import { getOne, post, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, humanize } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui';

interface Permission {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  slug: string;
  scope: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: { code: string; module: string } }[];
  _count: { users: number };
}

function RolePermissionEditor({
  role,
  grouped,
}: {
  role: Role;
  grouped: Record<string, Permission[]>;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(role.permissions.map((entry) => entry.permission.code)),
  );

  const savePermissions = useMutation({
    mutationFn: () => put(`/admin/roles/${role.id}`, { permissionCodes: [...selected] }),
    onSuccess: () => {
      toast.success('Role permissions updated');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles });
    },
  });

  const toggle = (code: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleModule = (permissions: Permission[]) => {
    const codes = permissions.map((permission) => permission.code);
    const allSelected = codes.every((code) => selected.has(code));
    setSelected((current) => {
      const next = new Set(current);
      codes.forEach((code) => (allSelected ? next.delete(code) : next.add(code)));
      return next;
    });
  };

  return (
    <Card className="lg:col-span-3">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {role.name}
            <Badge tone="neutral">{humanize(role.scope)}</Badge>
            {role.isSystem ? <Badge tone="info">System role</Badge> : null}
          </span>
        }
        description={`${selected.size} permission(s) selected`}
        action={
          <Button
            icon={<Save className="h-4 w-4" />}
            loading={savePermissions.isPending}
            onClick={() => savePermissions.mutate()}
          >
            Save permissions
          </Button>
        }
      />

      <div className="space-y-5">
        {Object.entries(grouped).map(([module, permissions]) => {
          const allSelected = permissions.every((permission) => selected.has(permission.code));
          return (
            <div key={module} className="rounded-lg border border-ink-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold capitalize text-ink-800">{module}</h3>
                <Button variant="ghost" size="sm" onClick={() => toggleModule(permissions)}>
                  {allSelected ? 'Clear all' : 'Select all'}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {permissions.map((permission) => (
                  <Checkbox
                    key={permission.code}
                    label={
                      <span>
                        <span className="block text-sm capitalize">
                          {permission.code.split('.')[1]}
                        </span>
                        <span className="block font-mono text-[11px] text-ink-400">
                          {permission.code}
                        </span>
                      </span>
                    }
                    checked={selected.has(permission.code)}
                    onChange={() => toggle(permission.code)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', scope: 'ADMIN_STAFF' });

  const { data: roles, isLoading } = useQuery({
    queryKey: queryKeys.admin.roles,
    queryFn: () => getOne<Role[]>('/admin/roles'),
  });

  const { data: permissionData } = useQuery({
    queryKey: queryKeys.admin.permissions,
    queryFn: () =>
      getOne<{ permissions: Permission[]; grouped: Record<string, Permission[]> }>('/admin/permissions'),
  });

  const activeRole = useMemo(
    () => roles?.find((role) => role.id === activeRoleId) ?? roles?.[0],
    [roles, activeRoleId],
  );

  const createRole = useMutation({
    mutationFn: () =>
      post('/admin/roles', { name: newRole.name, scope: newRole.scope, permissionCodes: [] }),
    onSuccess: () => {
      toast.success('Role created');
      setCreateOpen(false);
      setNewRole({ name: '', scope: 'ADMIN_STAFF' });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.roles });
    },
  });

  if (isLoading || !roles) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Roles & access"
        description="Roles bundle permissions. Assign them to users to control exactly what each person can do."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            New role
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card padded={false} className="h-fit overflow-hidden lg:col-span-1">
          <ul>
            {roles.map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => setActiveRoleId(role.id)}
                  className={cn(
                    'w-full border-b border-ink-100 px-4 py-3 text-left transition-colors last:border-0',
                    activeRole?.id === role.id ? 'bg-brand-50' : 'hover:bg-ink-50',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink-900">{role.name}</span>
                    {role.isSystem ? <Lock className="h-3.5 w-3.5 text-ink-400" /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    {role._count.users} user(s) · {role.permissions.length} permissions
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {activeRole ? (
          <RolePermissionEditor
            // Remounting per role seeds the checkbox state without an effect.
            key={activeRole.id}
            role={activeRole}
            grouped={permissionData?.grouped ?? {}}
          />
        ) : null}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a role"
        description="Start with no permissions, then grant exactly what the role needs."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={createRole.isPending}
              onClick={() => {
                if (newRole.name.trim().length < 2) {
                  toast.error('Enter a role name');
                  return;
                }
                createRole.mutate();
              }}
            >
              Create role
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Role name"
            required
            placeholder="Catalogue manager"
            value={newRole.name}
            onChange={(event) => setNewRole((current) => ({ ...current, name: event.target.value }))}
          />
          <Select
            label="Applies to"
            value={newRole.scope}
            onChange={(event) => setNewRole((current) => ({ ...current, scope: event.target.value }))}
            options={[
              { value: 'ADMIN_STAFF', label: 'Admin staff' },
              { value: 'VENDOR', label: 'Wholesaler' },
              { value: 'RETAILER', label: 'Medical shop' },
            ]}
          />
        </div>
      </Modal>
    </>
  );
}
