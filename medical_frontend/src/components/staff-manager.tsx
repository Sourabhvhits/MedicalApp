'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserCheck, UserPlus, UserX } from 'lucide-react';
import { ApiError, getOne, patch, post } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import type { StaffMember, StaffRole } from '@/lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, Input, LoadingBlock, Modal, Select } from '@/components/ui';

const EMPTY_FORM = { firstName: '', lastName: '', email: '', phone: '', password: '', roleId: '' };

/**
 * Staff sub-account management — shared between `/vendor/profile` and
 * `/retailer/store` (TASKS.md #6). The owner sets the initial password
 * directly and shares it with the invited staff member out of band, same as
 * how `/admin/users` already creates an admin-staff account — no
 * email-invite-link flow exists anywhere in this app yet, so this doesn't
 * invent a second, inconsistent pattern.
 */
export function StaffManager({ basePath }: { basePath: string }) {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const staffKey = [basePath, 'staff'];

  const { data: staff, isLoading } = useQuery({
    queryKey: staffKey,
    queryFn: () => getOne<StaffMember[]>(`${basePath}/staff`),
  });

  const { data: roles } = useQuery({
    queryKey: [basePath, 'staff', 'roles'],
    queryFn: () => getOne<StaffRole[]>(`${basePath}/staff/roles`),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: staffKey });

  const invite = useMutation({
    mutationFn: () => post(`${basePath}/staff`, form),
    onSuccess: () => {
      toast.success('Staff member invited');
      setInviteOpen(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not invite staff member');
    },
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      patch(`${basePath}/staff/${input.id}/status`, { status: input.status }),
    onSuccess: (_data, variables) => {
      toast.success(variables.status === 'ACTIVE' ? 'Staff member activated' : 'Staff member deactivated');
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update staff member');
    },
  });

  return (
    <Card>
      <CardHeader
        title="Staff"
        description="Invite team members to help manage your catalogue, stock and orders."
        action={
          <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
            Invite staff
          </Button>
        }
      />

      {isLoading ? (
        <LoadingBlock />
      ) : !staff || staff.length === 0 ? (
        <EmptyState title="No staff yet" description="Invite someone to help run day-to-day operations." />
      ) : (
        <ul className="divide-y divide-ink-100">
          {staff.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-ink-900">
                  {member.user.firstName} {member.user.lastName ?? ''}
                </p>
                <p className="text-xs text-ink-500">
                  {member.user.email} · {member.user.roles.map((r) => r.role.name).join(', ') || 'No role'}
                </p>
                <p className="text-xs text-ink-400">
                  {member.user.lastLoginAt ? `Last active ${formatDateTime(member.user.lastLoginAt)}` : 'Never logged in'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={member.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {member.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  icon={
                    member.status === 'ACTIVE' ? (
                      <UserX className="h-3.5 w-3.5" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" />
                    )
                  }
                  loading={setStatus.isPending}
                  onClick={() =>
                    setStatus.mutate({
                      id: member.id,
                      status: member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                    })
                  }
                >
                  {member.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a staff member"
        description="They sign in with this email/phone and password — share the password with them directly."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={invite.isPending}
              onClick={() => {
                if (!form.roleId) {
                  toast.error('Choose a role');
                  return;
                }
                invite.mutate();
              }}
            >
              Send invite
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              required
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
            <Input
              label="Last name"
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            label="Phone"
            required
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            label="Temporary password"
            type="password"
            required
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <Select
            label="Role"
            value={form.roleId}
            onChange={(event) => setForm({ ...form, roleId: event.target.value })}
            options={[
              { value: '', label: 'Choose a role' },
              ...(roles ?? []).map((role) => ({ value: role.id, label: role.name })),
            ]}
          />
        </div>
      </Modal>
    </Card>
  );
}
