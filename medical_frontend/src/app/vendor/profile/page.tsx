'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormik } from 'formik';
import { toast } from 'sonner';
import { FileText, Trash2, Upload } from 'lucide-react';
import { ApiError, del, getOne, put, upload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { formatDate, humanize } from '@/lib/utils';
import type { BusinessDocument, KycRequirement, Vendor } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { ApprovalBadge } from '@/components/ui/status';
import { StaffManager } from '@/components/staff-manager';
import { WarehouseManager } from '@/components/warehouse-manager';
import { NotificationTemplateEditor } from '@/components/notification-template-editor';

interface ProfileForm {
  businessName: string;
  legalName: string;
  contactPerson: string;
  email: string;
  phone: string;
  alternatePhone: string;
  gstNumber: string;
  panNumber: string;
  drugLicenseNumber: string;
  drugLicenseExpiry: string;
  description: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  minOrderValue: string;
}

export default function VendorProfilePage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [deleting, setDeleting] = useState<BusinessDocument | null>(null);

  const { data: vendor, isLoading } = useQuery({
    queryKey: queryKeys.vendor.profile,
    queryFn: () => getOne<Vendor>('/vendor/profile'),
  });

  // Admin-configurable (TASKS.md #20a) — which document types to offer here
  // is no longer hardcoded, see `/admin/kyc-requirements`.
  const { data: documentTypes } = useQuery({
    queryKey: queryKeys.kycRequirements('VENDOR'),
    queryFn: () => getOne<Pick<KycRequirement, 'documentType' | 'isRequired'>[]>('/config/kyc-requirements', { ownerType: 'VENDOR' }),
  });
  const documentTypeOptions = (documentTypes ?? []).map((requirement) => ({
    value: requirement.documentType,
    label: `${humanize(requirement.documentType)}${requirement.isRequired ? ' (required)' : ''}`,
  }));
  const effectiveDocumentType = documentType || documentTypeOptions[0]?.value || '';

  // `enableReinitialize` re-seeds values once the async `vendor` query resolves,
  // instead of an effect calling `resetForm` after the fact.
  const form = useFormik<ProfileForm>({
    initialValues: {
      businessName: vendor?.businessName ?? '',
      legalName: (vendor as (Vendor & { legalName?: string }) | undefined)?.legalName ?? '',
      contactPerson: vendor?.contactPerson ?? '',
      email: vendor?.email ?? '',
      phone: vendor?.phone ?? '',
      alternatePhone: '',
      gstNumber: vendor?.gstNumber ?? '',
      panNumber: '',
      drugLicenseNumber: vendor?.drugLicenseNumber ?? '',
      drugLicenseExpiry: '',
      description: '',
      addressLine1: '',
      addressLine2: '',
      city: vendor?.city ?? '',
      state: vendor?.state ?? '',
      pincode: vendor?.pincode ?? '',
      latitude: '',
      longitude: '',
      minOrderValue: String(vendor?.minOrderValue ?? 0),
    },
    enableReinitialize: true,
    onSubmit: (values) => save.mutate(values),
  });

  const save = useMutation({
    mutationFn: (values: ProfileForm) => {
      // Only send fields the user actually filled — the API treats every
      // profile field as optional and validates format strictly.
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== '' && value !== undefined),
      );
      if (payload.minOrderValue) payload.minOrderValue = Number(payload.minOrderValue) as never;
      return put('/vendor/profile', payload);
    },
    onSuccess: () => {
      toast.success('Profile updated');
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendor.profile });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          form.setFieldError(field, message);
          form.setFieldTouched(field, true, false);
        });
        if (Object.keys(error.fieldErrors).length === 0) toast.error(error.message);
      }
    },
  });

  const uploadDocument = useMutation({
    mutationFn: () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choose a file');
      const data = new FormData();
      data.append('file', file);
      data.append('type', effectiveDocumentType);
      if (documentNo) data.append('documentNo', documentNo);
      return upload('/vendor/documents', data);
    },
    onSuccess: () => {
      toast.success('Document uploaded for review');
      setUploadOpen(false);
      setDocumentNo('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendor.profile });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Upload failed');
    },
  });

  const removeDocument = useMutation({
    mutationFn: (id: string) => del(`/vendor/documents/${id}`),
    onSuccess: () => {
      toast.success('Document removed');
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.vendor.profile });
    },
  });

  if (isLoading || !vendor) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Company profile"
        description="Your business, licence and address details. Changing a statutory number sends your account back for review."
        action={<ApprovalBadge status={vendor.approvalStatus} />}
      />

      {vendor.approvalStatus !== 'APPROVED' ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm text-amber-900">
          {vendor.rejectionReason ? (
            <p>
              <span className="font-semibold">Admin note:</span> {vendor.rejectionReason}
            </p>
          ) : (
            <p>
              Complete your profile and upload your drug licence and GST certificate. A platform admin
              reviews these before you can sell.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Business details" />
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit}>
              <Input
                label="Business name"
                required
                className="sm:col-span-2"
                error={form.touched.businessName ? form.errors.businessName : undefined}
                {...form.getFieldProps('businessName')}
              />
              <Input label="Legal name" {...form.getFieldProps('legalName')} />
              <Input label="Contact person" {...form.getFieldProps('contactPerson')} />
              <Input
                label="Email"
                type="email"
                error={form.touched.email ? form.errors.email : undefined}
                {...form.getFieldProps('email')}
              />
              <Input
                label="Phone"
                error={form.touched.phone ? form.errors.phone : undefined}
                {...form.getFieldProps('phone')}
              />
              <Input
                label="GSTIN"
                placeholder="27AAACM1234A1Z7"
                error={form.touched.gstNumber ? form.errors.gstNumber : undefined}
                {...form.getFieldProps('gstNumber')}
              />
              <Input
                label="PAN"
                placeholder="AAACM1234A"
                error={form.touched.panNumber ? form.errors.panNumber : undefined}
                {...form.getFieldProps('panNumber')}
              />
              <Input
                label="Drug licence number"
                error={form.touched.drugLicenseNumber ? form.errors.drugLicenseNumber : undefined}
                {...form.getFieldProps('drugLicenseNumber')}
              />
              <Input
                label="Drug licence expiry"
                type="date"
                {...form.getFieldProps('drugLicenseExpiry')}
              />
              <Input
                label="Minimum order value"
                type="number"
                step="0.01"
                hint="Retailers cannot order below this amount"
                error={form.touched.minOrderValue ? form.errors.minOrderValue : undefined}
                {...form.getFieldProps('minOrderValue')}
              />
              <Textarea
                label="About your business"
                className="sm:col-span-2"
                {...form.getFieldProps('description')}
              />

              <h3 className="sm:col-span-2 mt-2 text-sm font-semibold text-ink-800">
                Warehouse address
              </h3>
              <Input label="Address line 1" className="sm:col-span-2" {...form.getFieldProps('addressLine1')} />
              <Input label="Address line 2" className="sm:col-span-2" {...form.getFieldProps('addressLine2')} />
              <Input label="City" {...form.getFieldProps('city')} />
              <Input label="State" {...form.getFieldProps('state')} />
              <Input
                label="Pincode"
                error={form.touched.pincode ? form.errors.pincode : undefined}
                {...form.getFieldProps('pincode')}
              />
              <div />
              <Input
                label="Latitude"
                type="number"
                step="0.0000001"
                error={form.touched.latitude ? form.errors.latitude : undefined}
                {...form.getFieldProps('latitude')}
              />
              <Input
                label="Longitude"
                type="number"
                step="0.0000001"
                error={form.touched.longitude ? form.errors.longitude : undefined}
                {...form.getFieldProps('longitude')}
              />

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" loading={save.isPending}>
                  Save profile
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader
            title="Licence documents"
            description="Upload clear scans. An admin verifies each one."
            action={
              <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
                Upload
              </Button>
            }
          />
          {!vendor.documents || vendor.documents.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {vendor.documents.map((document) => (
                <li key={document.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800">
                        {humanize(document.type)}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {document.documentNo ?? document.fileName}
                      </p>
                      {document.expiryDate ? (
                        <p className="text-xs text-ink-500">
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
                  {document.remarks ? (
                    <p className="mt-2 rounded bg-ink-50 px-2 py-1 text-xs text-ink-600">
                      {document.remarks}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <a href={document.fileUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" icon={<FileText className="h-3.5 w-3.5" />}>
                        View
                      </Button>
                    </a>
                    {document.status !== 'APPROVED' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="h-3.5 w-3.5 text-danger" />}
                        onClick={() => setDeleting(document)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <WarehouseManager scope="vendor" basePath="/vendor/inventory" />
      </div>

      <div className="mt-4">
        <StaffManager basePath="/vendor" />
      </div>

      <div className="mt-6">
        <NotificationTemplateEditor
          basePath="/vendor"
          title="Notification messages"
          description="Customise the wording your retailers get about your purchase-order decisions. Leave any event unset to use the platform default."
        />
      </div>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload a document"
        description="JPG, PNG, WEBP or PDF up to 5 MB."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button loading={uploadDocument.isPending} onClick={() => uploadDocument.mutate()}>
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Document type"
            value={effectiveDocumentType}
            onChange={(event) => setDocumentType(event.target.value)}
            options={documentTypeOptions}
          />
          <Input
            label="Document number"
            placeholder="Licence or certificate number"
            value={documentNo}
            onChange={(event) => setDocumentNo(event.target.value)}
          />
          <div>
            <label htmlFor="document-file" className="mb-1.5 block text-sm font-medium text-ink-700">
              File
            </label>
            <input
              id="document-file"
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-white"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeDocument.mutate(deleting.id)}
        title="Remove document"
        message="This document will be deleted and will need to be uploaded again for verification."
        confirmLabel="Remove"
        loading={removeDocument.isPending}
      />
    </>
  );
}
