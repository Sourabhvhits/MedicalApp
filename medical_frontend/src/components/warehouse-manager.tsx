'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, Warehouse as WarehouseIcon } from 'lucide-react';
import { ApiError, getOne, post, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import type { Warehouse } from '@/lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, Input, LoadingBlock, Modal } from '@/components/ui';

const EMPTY_FORM = { name: '', code: '', addressLine1: '', city: '', state: '', pincode: '' };

/**
 * Warehouse / stock-location management (TASKS.md #10). Scoped to the
 * wholesaler per the backlog item, though the backend (`createInventoryRouter`)
 * treats vendor and retailer identically — the same `/warehouses` endpoints
 * already exist for retailers too, this manager just isn't wired into
 * `/retailer/store` since that wasn't asked for.
 */
export function WarehouseManager({ scope, basePath }: { scope: 'vendor' | 'retailer'; basePath: string }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const warehouseKey = queryKeys.inventory.warehouses(scope);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: warehouseKey,
    queryFn: () => getOne<Warehouse[]>(`${basePath}/warehouses`),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: warehouseKey });

  const create = useMutation({
    mutationFn: () => post(`${basePath}/warehouses`, form),
    onSuccess: () => {
      toast.success('Warehouse added');
      setAddOpen(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not add warehouse'),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; data: Record<string, unknown> }) =>
      put(`${basePath}/warehouses/${input.id}`, input.data),
    onSuccess: () => {
      toast.success('Warehouse updated');
      setEditingId(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not update warehouse'),
  });

  const startEdit = (warehouse: Warehouse) => {
    setEditForm({
      name: warehouse.name,
      code: warehouse.code,
      addressLine1: warehouse.addressLine1 ?? '',
      city: warehouse.city ?? '',
      state: warehouse.state ?? '',
      pincode: warehouse.pincode ?? '',
    });
    setEditingId(warehouse.id);
  };

  return (
    <Card>
      <CardHeader
        title="Warehouses"
        description="Stock locations you dispatch from. Add another one to split inventory by site."
        action={
          <Button size="sm" icon={<WarehouseIcon className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            Add warehouse
          </Button>
        }
      />

      {isLoading ? (
        <LoadingBlock />
      ) : !warehouses || warehouses.length === 0 ? (
        <EmptyState title="No warehouses yet" description="A default one is created automatically on first stock-in." />
      ) : (
        <ul className="divide-y divide-ink-100">
          {warehouses.map((warehouse) => (
            <li key={warehouse.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                  {warehouse.name}
                  {warehouse.isDefault ? <Badge tone="brand">Default</Badge> : null}
                  {!warehouse.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
                </p>
                <p className="text-xs text-ink-500">
                  {warehouse.code}
                  {[warehouse.addressLine1, warehouse.city, warehouse.state, warehouse.pincode]
                    .filter(Boolean)
                    .join(', ')
                    ? ` · ${[warehouse.addressLine1, warehouse.city, warehouse.state, warehouse.pincode].filter(Boolean).join(', ')}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!warehouse.isDefault && warehouse.isActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Star className="h-3.5 w-3.5" />}
                    loading={update.isPending}
                    onClick={() => update.mutate({ id: warehouse.id, data: { isDefault: true } })}
                  >
                    Set as default
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  loading={update.isPending}
                  onClick={() =>
                    update.mutate({ id: warehouse.id, data: { isActive: !warehouse.isActive } })
                  }
                >
                  {warehouse.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(warehouse)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a warehouse"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={create.isPending}
              onClick={() => {
                if (!form.name.trim() || !form.code.trim()) {
                  toast.error('Name and code are required');
                  return;
                }
                create.mutate();
              }}
            >
              Add warehouse
            </Button>
          </>
        }
      >
        <WarehouseForm form={form} setForm={setForm} />
      </Modal>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="Edit warehouse"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button
              loading={update.isPending}
              onClick={() => {
                if (!editingId) return;
                if (!editForm.name.trim() || !editForm.code.trim()) {
                  toast.error('Name and code are required');
                  return;
                }
                update.mutate({ id: editingId, data: editForm });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {editingId ? <WarehouseForm form={editForm} setForm={setEditForm} /> : null}
      </Modal>
    </Card>
  );
}

type FormState = typeof EMPTY_FORM;

function WarehouseForm({
  form,
  setForm,
}: {
  form: FormState;
  setForm: (updater: FormState | ((current: FormState) => FormState)) => void;
}) {
  return (
    <div className="space-y-3">
      <Input
        label="Name"
        required
        value={form.name}
        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
      />
      <Input
        label="Code"
        required
        placeholder="WH2"
        hint="Uppercase letters, numbers, - or _"
        value={form.code}
        onChange={(event) =>
          setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
        }
      />
      <Input
        label="Address"
        value={form.addressLine1}
        onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="City"
          value={form.city}
          onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
        />
        <Input
          label="State"
          value={form.state}
          onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
        />
      </div>
      <Input
        label="Pincode"
        value={form.pincode}
        onChange={(event) => setForm((current) => ({ ...current, pincode: event.target.value }))}
      />
    </div>
  );
}
