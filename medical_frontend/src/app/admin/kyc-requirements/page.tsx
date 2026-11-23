'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { ApiError, getOne, patch, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { humanize } from '@/lib/utils';
import type { KycRequirement } from '@/lib/types';
import { Button, Card, CardHeader, Checkbox, ErrorState, Input, LoadingBlock, Modal, PageHeader } from '@/components/ui';

type State = 'OFF' | 'OPTIONAL' | 'REQUIRED';

function stateOf(requirement: KycRequirement): State {
  if (!requirement.isActive) return 'OFF';
  return requirement.isRequired ? 'REQUIRED' : 'OPTIONAL';
}

const STATE_UPDATE: Record<State, { isActive: boolean; isRequired: boolean }> = {
  OFF: { isActive: false, isRequired: false },
  OPTIONAL: { isActive: true, isRequired: false },
  REQUIRED: { isActive: true, isRequired: true },
};

const OWNER_COLUMNS: { ownerType: 'VENDOR' | 'RETAILER'; title: string; description: string }[] = [
  { ownerType: 'VENDOR', title: 'Wholesalers', description: 'Documents offered on the vendor profile page.' },
  { ownerType: 'RETAILER', title: 'Medical shops', description: 'Documents offered on the retailer store page.' },
];

export default function AdminKycRequirementsPage() {
  const queryClient = useQueryClient();
  const [addingFor, setAddingFor] = useState<'VENDOR' | 'RETAILER' | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.admin.kycRequirements,
    queryFn: () => getOne<KycRequirement[]>('/admin/kyc-requirements'),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.kycRequirements });

  const update = useMutation({
    mutationFn: (input: { id: string; state: State }) =>
      patch(`/admin/kyc-requirements/${input.id}`, STATE_UPDATE[input.state]),
    onSuccess: invalidate,
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not update the requirement'),
  });

  return (
    <>
      <PageHeader
        title="KYC requirements"
        description="Choose which licence and identity documents each business type is asked for — required, optional, or hidden."
      />

      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorState message={(error as Error).message} onRetry={() => void refetch()} /> : null}

      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {OWNER_COLUMNS.map((column) => (
            <Card key={column.ownerType}>
              <CardHeader
                title={column.title}
                description={column.description}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setAddingFor(column.ownerType)}
                  >
                    Add
                  </Button>
                }
              />
              <ul className="divide-y divide-ink-100">
                {data
                  .filter((requirement) => requirement.ownerType === column.ownerType)
                  .map((requirement) => (
                    <li key={requirement.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="text-sm font-medium text-ink-800">{humanize(requirement.documentType)}</span>
                      <div className="inline-flex rounded-lg border border-ink-200 p-0.5 text-xs font-medium">
                        {(['OFF', 'OPTIONAL', 'REQUIRED'] as State[]).map((state) => {
                          const active = stateOf(requirement) === state;
                          return (
                            <button
                              key={state}
                              type="button"
                              disabled={update.isPending}
                              onClick={() => update.mutate({ id: requirement.id, state })}
                              className={`rounded-md px-2.5 py-1 transition-colors ${
                                active
                                  ? state === 'REQUIRED'
                                    ? 'bg-brand-700 text-white'
                                    : state === 'OPTIONAL'
                                      ? 'bg-ink-700 text-white'
                                      : 'bg-ink-200 text-ink-700'
                                  : 'text-ink-500 hover:bg-ink-50'
                              }`}
                            >
                              {humanize(state)}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : null}

      <AddDocumentTypeModal ownerType={addingFor} onClose={() => setAddingFor(null)} onAdded={invalidate} />
    </>
  );
}

function AddDocumentTypeModal({
  ownerType,
  onClose,
  onAdded,
}: {
  ownerType: 'VENDOR' | 'RETAILER' | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [label, setLabel] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  const reset = () => {
    setLabel('');
    setIsRequired(false);
  };

  const add = useMutation({
    mutationFn: () => post('/admin/kyc-requirements', { ownerType, label, isRequired }),
    onSuccess: () => {
      toast.success('Document type added');
      reset();
      onAdded();
      onClose();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not add the document type'),
  });

  const title = ownerType === 'VENDOR' ? 'Wholesalers' : 'Medical shops';

  return (
    <Modal
      open={Boolean(ownerType)}
      onClose={() => {
        reset();
        onClose();
      }}
      title={`Add a document type — ${title}`}
      description="Give it a name; it appears on the upload form immediately."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={add.isPending} disabled={!label.trim()} onClick={() => add.mutate()}>
            Add document type
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Document type name"
          placeholder="FSSAI licence"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <Checkbox
          label="Required (not just optional)"
          checked={isRequired}
          onChange={(event) => setIsRequired(event.target.checked)}
        />
      </div>
    </Modal>
  );
}
