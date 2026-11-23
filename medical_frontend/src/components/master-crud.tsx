'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFormik } from 'formik';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ApiError, del, post, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery, type ListParams } from '@/hooks/use-list';
import { Button, ConfirmDialog, Input, Modal, PageHeader, Select } from '@/components/ui';
import { DataTable, FilterBar, SearchInput, type Column } from '@/components/ui/data-table';

export interface MasterField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** Hidden when editing — used for immutable keys such as a parent category. */
  createOnly?: boolean;
  defaultValue?: string | number;
  fullWidth?: boolean;
}

interface MasterCrudPageProps<T extends { id: string }> {
  title: string;
  description: string;
  singular: string;
  endpoint: string;
  queryKeyFactory: (params: ListParams) => readonly unknown[];
  columns: Column<T>[];
  fields: MasterField[];
  /** Maps an existing record onto the form values. */
  toFormValues: (record: T) => Record<string, string | number>;
  searchPlaceholder?: string;
  extraFilters?: ReactNode;
  initialFilters?: ListParams;
}

const STATUS_FIELD: MasterField = {
  name: 'status',
  label: 'Status',
  type: 'select',
  defaultValue: 'ACTIVE',
  options: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ],
};

/**
 * Shared list + create/edit/delete screen for the simple master tables.
 * Categories, sub-categories, manufacturers and units all behave identically,
 * so they share one implementation rather than four near-copies.
 */
export function MasterCrudPage<T extends { id: string }>({
  title,
  description,
  singular,
  endpoint,
  queryKeyFactory,
  columns,
  fields,
  toFormValues,
  searchPlaceholder,
  extraFilters,
  initialFilters,
}: MasterCrudPageProps<T>) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  const list = useListQuery<T>(endpoint, queryKeyFactory, { initialFilters });
  const allFields = [...fields, STATUS_FIELD];

  const defaultValues = () =>
    Object.fromEntries(
      allFields.map((field) => [field.name, field.defaultValue ?? (field.options?.[0]?.value ?? '')]),
    );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.masters.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  };

  const form = useFormik<Record<string, string | number>>({
    initialValues: defaultValues(),
    validate: (values) => {
      const missing = allFields.filter(
        (field) => field.required && !String(values[field.name] ?? '').trim(),
      );
      return Object.fromEntries(missing.map((field) => [field.name, `${field.label} is required`]));
    },
    onSubmit: (values) => {
      const payload = Object.fromEntries(
        Object.entries(values).filter(([key, value]) => {
          if (value === '' || value === undefined) return false;
          // Immutable keys are never sent on an update.
          if (editing && allFields.find((field) => field.name === key)?.createOnly) return false;
          return true;
        }),
      );
      save.mutate(payload);
    },
  });

  const closeForm = () => setFormOpen(false);

  const save = useMutation({
    mutationFn: (payload: Record<string, string | number>) =>
      editing ? put(`${endpoint}/${editing.id}`, payload) : post(endpoint, payload),
    onSuccess: () => {
      toast.success(editing ? `${singular} updated` : `${singular} created`);
      setFormOpen(false);
      setEditing(null);
      invalidate();
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

  const remove = useMutation({
    mutationFn: (id: string) => del(`${endpoint}/${id}`),
    onSuccess: () => {
      toast.success(`${singular} deleted`);
      setDeleting(null);
      invalidate();
    },
  });

  const actionColumn: Column<T> = {
    key: 'actions',
    header: '',
    className: 'text-right',
    render: (row) => (
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit"
          onClick={() => {
            setEditing(row);
            form.resetForm({ values: toFormValues(row) });
            setFormOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleting(row)}>
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
    ),
  };

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              form.resetForm({ values: defaultValues() });
              setFormOpen(true);
            }}
          >
            Add {singular.toLowerCase()}
          </Button>
        }
      />

      <DataTable
        columns={[...columns, actionColumn]}
        rows={list.rows}
        rowKey={(row) => row.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle={`No ${title.toLowerCase()} yet`}
        emptyDescription={`Create your first ${singular.toLowerCase()} to get started.`}
        toolbar={
          <FilterBar>
            <SearchInput
              value={list.search}
              onChange={list.setSearch}
              placeholder={searchPlaceholder ?? `Search ${title.toLowerCase()}`}
              className="w-full sm:w-80"
            />
            <Select
              aria-label="Status"
              value={(list.filters.status as string) ?? 'ALL'}
              onChange={(event) => list.setFilter('status', event.target.value)}
              className="w-40"
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
            {extraFilters}
          </FilterBar>
        }
      />

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`}
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button onClick={() => form.handleSubmit()} loading={save.isPending}>
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {allFields
            .filter((field) => !(editing && field.createOnly))
            .map((field) =>
              field.type === 'select' ? (
                <Select
                  key={field.name}
                  label={field.label}
                  required={field.required}
                  error={form.touched[field.name] ? (form.errors[field.name] as string) : undefined}
                  className={field.fullWidth ? 'sm:col-span-2' : undefined}
                  options={field.options}
                  {...form.getFieldProps(field.name)}
                />
              ) : (
                <Input
                  key={field.name}
                  label={field.label}
                  type={field.type ?? 'text'}
                  required={field.required}
                  placeholder={field.placeholder}
                  hint={field.hint}
                  error={form.touched[field.name] ? (form.errors[field.name] as string) : undefined}
                  className={field.fullWidth ? 'sm:col-span-2' : undefined}
                  {...form.getFieldProps(field.name)}
                />
              ),
            )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title={`Delete ${singular.toLowerCase()}`}
        message={`This ${singular.toLowerCase()} will be deactivated. Records that already reference it are kept intact.`}
        confirmLabel="Delete"
        loading={remove.isPending}
      />
    </>
  );
}
