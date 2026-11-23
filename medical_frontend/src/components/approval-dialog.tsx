'use client';

import { useState } from 'react';
import type { ApprovalStatus } from '@/lib/types';
import { Button, Modal, Select, Textarea } from '@/components/ui';

const DECISIONS = [
  { value: 'APPROVED', label: 'Approve — allow trading' },
  { value: 'UNDER_REVIEW', label: 'Mark under review' },
  { value: 'REJECTED', label: 'Reject application' },
  { value: 'SUSPENDED', label: 'Suspend account' },
];

/**
 * Shared approval control for vendors and medical shops. A reason is mandatory
 * for rejection and suspension, matching the API's validation.
 */
export function ApprovalDialog({
  open,
  title,
  currentStatus,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  currentStatus?: ApprovalStatus;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (decision: ApprovalStatus, reason?: string) => void;
}) {
  if (!open) return null;

  return (
    <ApprovalForm
      // Remounting per subject gives each dialog a clean form without an effect.
      key={`${title}-${currentStatus ?? ''}`}
      title={title}
      currentStatus={currentStatus}
      loading={loading}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function ApprovalForm({
  title,
  currentStatus,
  loading,
  onClose,
  onSubmit,
}: {
  title: string;
  currentStatus?: ApprovalStatus;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (decision: ApprovalStatus, reason?: string) => void;
}) {
  // An already-approved business is most often being suspended, not re-approved.
  const [decision, setDecision] = useState<ApprovalStatus>(
    currentStatus === 'APPROVED' ? 'SUSPENDED' : 'APPROVED',
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const needsReason = decision === 'REJECTED' || decision === 'SUSPENDED';

  const submit = () => {
    if (needsReason && reason.trim().length < 3) {
      setError('Give a reason — it is shown to the business and stored in the audit log.');
      return;
    }
    onSubmit(decision, reason.trim() || undefined);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={
        currentStatus ? `Current status: ${currentStatus.replace('_', ' ').toLowerCase()}` : undefined
      }
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={needsReason ? 'danger' : 'primary'} onClick={submit} loading={loading}>
            Save decision
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Decision"
          value={decision}
          onChange={(event) => {
            setDecision(event.target.value as ApprovalStatus);
            setError(null);
          }}
          options={DECISIONS}
        />

        <Textarea
          label="Reason / remarks"
          required={needsReason}
          placeholder={
            needsReason
              ? 'Explain what is missing or why the account is being suspended'
              : 'Optional note for the audit log'
          }
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
          error={error ?? undefined}
        />

        {decision === 'APPROVED' ? (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
            Approving creates the default stock location and makes the business visible on the
            marketplace.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
