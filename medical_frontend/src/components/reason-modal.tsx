'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Modal, Textarea } from '@/components/ui';

/**
 * Shared "confirm with a reason" dialog. Originally a single-purpose
 * `RejectOrderModal`; generalized so every "explain why" action (rejecting an
 * order, rejecting a prescription, an admin force-cancel, …) reuses one
 * dialog instead of each screen growing its own copy.
 */
export function ReasonModal<T>({
  subject,
  title,
  description,
  confirmLabel,
  placeholder,
  loading,
  onClose,
  onSubmit,
}: {
  subject: T | null;
  title: string;
  description?: (subject: T) => string;
  confirmLabel: string;
  placeholder: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal
      open={Boolean(subject)}
      onClose={onClose}
      title={title}
      description={subject && description ? description(subject) : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => {
              if (reason.trim().length < 3) {
                toast.error('A reason is required');
                return;
              }
              onSubmit(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea
        label="Reason"
        required
        placeholder={placeholder}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </Modal>
  );
}
