'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Pencil, Plus, ShieldCheck, ShieldX, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { ApiError, del, getOne, patch, put, upload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { formatDate, humanize } from '@/lib/utils';
import type { ApprovalStatus, BusinessDocument, KycRequirement } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui';
import { ApprovalBadge } from '@/components/ui/status';
import { ApprovalDialog } from '@/components/approval-dialog';

export interface DetailField {
  label: string;
  value: ReactNode;
}

interface BusinessDetailProps<T> {
  id: string;
  kind: 'vendor' | 'retailer';
  backHref: string;
  backLabel: string;
  /** Maps the loaded record into the page title and field groups. */
  present: (record: T) => {
    title: string;
    subtitle: string;
    approvalStatus: ApprovalStatus;
    rejectionReason?: string | null;
    groups: { title: string; fields: DetailField[] }[];
    extra?: ReactNode;
  };
}

/**
 * Shared admin detail view for wholesalers and medical shops: profile fields,
 * KYC document review and the approval decision.
 */
export function BusinessDetail<T extends { id: string; documents?: BusinessDocument[] }>({
  id,
  kind,
  backHref,
  backLabel,
  present,
}: BusinessDetailProps<T>) {
  const queryClient = useQueryClient();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessDocument | null>(null);
  const [deleting, setDeleting] = useState<BusinessDocument | null>(null);

  const detailKey = kind === 'vendor' ? queryKeys.admin.vendor(id) : queryKeys.admin.retailer(id);
  const endpoint = kind === 'vendor' ? `/admin/vendors/${id}` : `/admin/retailers/${id}`;
  const ownerType = kind === 'vendor' ? 'VENDOR' : 'RETAILER';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: detailKey,
    queryFn: () => getOne<T>(endpoint),
  });

  // Admin-configurable (TASKS.md #20a) — the registry of document types
  // admin can add to/choose from here, instead of a hardcoded list.
  const { data: documentTypes } = useQuery({
    queryKey: queryKeys.admin.kycRequirementsFor(ownerType),
    queryFn: () => getOne<KycRequirement[]>('/admin/kyc-requirements', { ownerType }),
  });
  const documentTypeOptions = (documentTypes ?? []).map((requirement) => ({
    value: requirement.documentType,
    label: humanize(requirement.documentType),
  }));

  const decide = useMutation({
    mutationFn: (input: { decision: ApprovalStatus; reason?: string }) =>
      patch(`${endpoint}/approval`, input),
    onSuccess: () => {
      toast.success('Decision saved');
      setReviewOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });

  const reviewDocument = useMutation({
    mutationFn: (input: { documentId: string; status: 'APPROVED' | 'REJECTED' }) =>
      patch(`/admin/documents/${kind}/${input.documentId}`, { status: input.status }),
    onSuccess: (_result, variables) => {
      toast.success(`Document ${variables.status.toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  });

  const addDocument = useMutation({
    mutationFn: (formData: FormData) => upload(`/admin/documents/${kind}/${id}`, formData),
    onSuccess: () => {
      toast.success('Document added');
      setAddOpen(false);
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not add the document'),
  });

  const updateDocument = useMutation({
    mutationFn: (input: {
      documentId: string;
      type: string;
      documentNo: string;
      issueDate: string;
      expiryDate: string;
    }) =>
      put(`/admin/documents/${kind}/${input.documentId}`, {
        type: input.type,
        documentNo: input.documentNo || undefined,
        issueDate: input.issueDate || null,
        expiryDate: input.expiryDate || null,
      }),
    onSuccess: () => {
      toast.success('Document updated');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not update the document'),
  });

  const removeDocument = useMutation({
    mutationFn: (documentId: string) => del(`/admin/documents/${kind}/${documentId}`),
    onSuccess: () => {
      toast.success('Document removed');
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not remove the document'),
  });

  if (isLoading) return <LoadingBlock />;
  if (error || !data) {
    return <ErrorState message={(error as Error)?.message ?? 'Not found'} onRetry={() => void refetch()} />;
  }

  const view = present(data);

  return (
    <>
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <PageHeader
        title={view.title}
        description={view.subtitle}
        action={
          <>
            <ApprovalBadge status={view.approvalStatus} />
            <Button onClick={() => setReviewOpen(true)}>Review application</Button>
          </>
        }
      />

      {view.rejectionReason ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-danger-soft px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">Reason on file:</span> {view.rejectionReason}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {view.groups.map((group) => (
            <Card key={group.title}>
              <CardHeader title={group.title} />
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <div key={field.label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
                      {field.label}
                    </dt>
                    <dd className="mt-1 text-sm text-ink-800">{field.value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
          {view.extra}
        </div>

        <Card className="h-fit">
          <CardHeader
            title="KYC documents"
            description="Verify each licence before approving the account."
            action={
              <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>
                Add
              </Button>
            }
          />
          {!data.documents || data.documents.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No documents uploaded"
              description="The business has not submitted any licence or KYC files yet."
            />
          ) : (
            <ul className="space-y-3">
              {data.documents.map((document) => (
                <li key={document.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800">
                        {humanize(document.type)}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {document.documentNo ?? document.fileName ?? '—'}
                      </p>
                      {document.expiryDate ? (
                        <p className="mt-0.5 text-xs text-ink-500">
                          Valid to {formatDate(document.expiryDate)}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      tone={
                        document.status === 'APPROVED'
                          ? 'success'
                          : document.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {humanize(document.status)}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={document.fileUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" icon={<FileText className="h-3.5 w-3.5" />}>
                        Open
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ShieldCheck className="h-3.5 w-3.5" />}
                      disabled={document.status === 'APPROVED' || reviewDocument.isPending}
                      onClick={() =>
                        reviewDocument.mutate({ documentId: document.id, status: 'APPROVED' })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ShieldX className="h-3.5 w-3.5" />}
                      disabled={document.status === 'REJECTED' || reviewDocument.isPending}
                      onClick={() =>
                        reviewDocument.mutate({ documentId: document.id, status: 'REJECTED' })
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => setEditing(document)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5 text-danger" />}
                      onClick={() => setDeleting(document)}
                    >
                      Delete
                    </Button>
                  </div>

                  {document.remarks ? (
                    <p className="mt-2 text-xs text-ink-500">Remarks: {document.remarks}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ApprovalDialog
        open={reviewOpen}
        title={`Review ${view.title}`}
        currentStatus={view.approvalStatus}
        loading={decide.isPending}
        onClose={() => setReviewOpen(false)}
        onSubmit={(decision, reason) => decide.mutate({ decision, reason })}
      />

      <AddDocumentModal
        open={addOpen}
        loading={addDocument.isPending}
        options={documentTypeOptions}
        onClose={() => setAddOpen(false)}
        onSubmit={(formData) => addDocument.mutate(formData)}
      />

      <EditDocumentModal
        document={editing}
        loading={updateDocument.isPending}
        options={documentTypeOptions}
        onClose={() => setEditing(null)}
        onSubmit={(input) => editing && updateDocument.mutate({ documentId: editing.id, ...input })}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeDocument.mutate(deleting.id)}
        title="Remove document"
        message={`"${deleting ? humanize(deleting.type) : ''}" will be permanently deleted, including its uploaded file.`}
        confirmLabel="Remove"
        loading={removeDocument.isPending}
      />
    </>
  );
}

function AddDocumentModal({
  open,
  loading,
  options,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  options: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const [type, setType] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const effectiveType = type || options[0]?.value || '';

  const reset = () => {
    setType('');
    setDocumentNo('');
    setExpiryDate('');
    setFile(null);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add a KYC document"
      description="Upload on the business's behalf — useful when a document was collected outside the app."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!file}
            onClick={() => {
              if (!file) return;
              const formData = new FormData();
              formData.append('file', file);
              formData.append('type', effectiveType);
              if (documentNo) formData.append('documentNo', documentNo);
              if (expiryDate) formData.append('expiryDate', expiryDate);
              onSubmit(formData);
              reset();
            }}
          >
            Add document
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Document type" value={effectiveType} onChange={(event) => setType(event.target.value)} options={options} />
        <Input label="Document number" value={documentNo} onChange={(event) => setDocumentNo(event.target.value)} />
        <Input label="Expiry date" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
        <div>
          <label htmlFor="admin-document-file" className="mb-1.5 block text-sm font-medium text-ink-700">
            File
          </label>
          <input
            id="admin-document-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-white"
          />
        </div>
      </div>
    </Modal>
  );
}

function EditDocumentModal({
  document,
  loading,
  options,
  onClose,
  onSubmit,
}: {
  document: BusinessDocument | null;
  loading: boolean;
  options: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (input: { type: string; documentNo: string; issueDate: string; expiryDate: string }) => void;
}) {
  const [type, setType] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [seededFor, setSeededFor] = useState<string | null>(null);

  if (document && seededFor !== document.id) {
    setType(document.type);
    setDocumentNo(document.documentNo ?? '');
    setIssueDate(document.issueDate ? document.issueDate.slice(0, 10) : '');
    setExpiryDate(document.expiryDate ? document.expiryDate.slice(0, 10) : '');
    setSeededFor(document.id);
  }

  return (
    <Modal
      open={Boolean(document)}
      onClose={onClose}
      title="Edit document details"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={() => onSubmit({ type, documentNo, issueDate, expiryDate })}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Document type" value={type} onChange={(event) => setType(event.target.value)} options={options} />
        <Input label="Document number" value={documentNo} onChange={(event) => setDocumentNo(event.target.value)} />
        <Input label="Issue date" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
        <Input label="Expiry date" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
      </div>
    </Modal>
  );
}
