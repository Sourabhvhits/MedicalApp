'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormik } from 'formik';
import { toast } from 'sonner';
import { Crosshair, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { ApiError, del, getOne, patch, post, put, upload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { DAY_NAMES, formatDate, humanize, todayISO } from '@/lib/utils';
import type { BusinessDocument, BusinessHour, KycRequirement, Retailer } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
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
import { NotificationTemplateEditor } from '@/components/notification-template-editor';

interface StoreForm {
  storeName: string;
  ownerName: string;
  email: string;
  phone: string;
  gstNumber: string;
  drugLicenseNumber: string;
  description: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
}

interface Holiday {
  id: string;
  date: string;
  title: string | null;
  isFullDay: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export default function RetailerStorePage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [hoursDraft, setHoursDraft] = useState<BusinessHour[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState('');
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ date: todayISO(), title: '', isFullDay: true });
  const [deletingDocument, setDeletingDocument] = useState<BusinessDocument | null>(null);

  const { data: store, isLoading } = useQuery({
    queryKey: queryKeys.retailer.profile,
    queryFn: () => getOne<Retailer>('/retailer/profile'),
  });

  // Admin-configurable (TASKS.md #20a) — which document types to offer here
  // is no longer hardcoded, see `/admin/kyc-requirements`.
  const { data: documentTypes } = useQuery({
    queryKey: queryKeys.kycRequirements('RETAILER'),
    queryFn: () => getOne<Pick<KycRequirement, 'documentType' | 'isRequired'>[]>('/config/kyc-requirements', { ownerType: 'RETAILER' }),
  });
  const documentTypeOptions = (documentTypes ?? []).map((requirement) => ({
    value: requirement.documentType,
    label: `${humanize(requirement.documentType)}${requirement.isRequired ? ' (required)' : ''}`,
  }));
  const effectiveDocumentType = documentType || documentTypeOptions[0]?.value || '';

  const { data: holidays } = useQuery({
    queryKey: queryKeys.retailer.holidays,
    queryFn: () => getOne<Holiday[]>('/retailer/holidays'),
  });

  // `enableReinitialize` re-seeds values once the async `store` query resolves,
  // instead of an effect calling `resetForm` after the fact.
  const form = useFormik<StoreForm>({
    initialValues: {
      storeName: store?.storeName ?? '',
      ownerName: store?.ownerName ?? '',
      email: store?.email ?? '',
      phone: store?.phone ?? '',
      gstNumber: store?.gstNumber ?? '',
      drugLicenseNumber: store?.drugLicenseNumber ?? '',
      description: store?.description ?? '',
      addressLine1: store?.addressLine1 ?? '',
      addressLine2: '',
      landmark: store?.landmark ?? '',
      city: store?.city ?? '',
      state: store?.state ?? '',
      pincode: store?.pincode ?? '',
      latitude: store?.latitude ? String(store.latitude) : '',
      longitude: store?.longitude ? String(store.longitude) : '',
    },
    enableReinitialize: true,
    onSubmit: (values) => saveProfile.mutate(values),
  });

  // Saved hours, or a sensible seven-day default until the store sets them.
  const savedHours: BusinessHour[] =
    store?.businessHours && store.businessHours.length === 7
      ? store.businessHours
      : Array.from({ length: 7 }, (_, day) => ({
          dayOfWeek: day,
          isClosed: false,
          openTime: '09:00',
          closeTime: '21:00',
        }));
  const hours = hoursDraft ?? savedHours;

  const setHours = (updater: (current: BusinessHour[]) => BusinessHour[]) =>
    setHoursDraft((current) => updater(current ?? savedHours));

  const saveProfile = useMutation({
    mutationFn: (values: StoreForm) => {
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== '' && value !== undefined),
      );
      return put('/retailer/profile', payload);
    },
    onSuccess: () => {
      toast.success('Store profile updated');
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.profile });
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

  const saveHours = useMutation({
    mutationFn: () =>
      put('/retailer/business-hours', {
        hours: hours.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          isClosed: hour.isClosed,
          openTime: hour.isClosed ? undefined : (hour.openTime ?? '09:00'),
          closeTime: hour.isClosed ? undefined : (hour.closeTime ?? '21:00'),
        })),
      }),
    onSuccess: () => {
      toast.success('Business hours saved — pickup slots will regenerate');
      setHoursDraft(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.all });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not save hours');
    },
  });

  const toggleClosure = useMutation({
    mutationFn: (isClosed: boolean) =>
      patch('/retailer/profile/closure', {
        isTemporarilyClosed: isClosed,
        closureReason: isClosed ? 'Temporarily closed by the store' : undefined,
      }),
    onSuccess: () => {
      toast.success('Store status updated');
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.profile });
    },
  });

  const [deliveryDraft, setDeliveryDraft] = useState<{
    deliveryEnabled: boolean;
    deliveryChargeAmount: string;
    deliveryFreeAboveAmount: string;
  } | null>(null);
  const delivery = deliveryDraft ?? {
    deliveryEnabled: store?.deliveryEnabled ?? false,
    deliveryChargeAmount: store ? String(store.deliveryChargeAmount) : '0',
    deliveryFreeAboveAmount: store?.deliveryFreeAboveAmount != null ? String(store.deliveryFreeAboveAmount) : '',
  };

  const saveDelivery = useMutation({
    mutationFn: () =>
      put('/retailer/profile', {
        deliveryEnabled: delivery.deliveryEnabled,
        deliveryChargeAmount: delivery.deliveryChargeAmount || '0',
        deliveryFreeAboveAmount: delivery.deliveryFreeAboveAmount,
      }),
    onSuccess: () => {
      toast.success('Delivery settings saved');
      setDeliveryDraft(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.profile });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save delivery settings'),
  });

  const addHoliday = useMutation({
    mutationFn: () =>
      post('/retailer/holidays', {
        date: holidayForm.date,
        title: holidayForm.title || undefined,
        isFullDay: holidayForm.isFullDay,
      }),
    onSuccess: () => {
      toast.success('Holiday saved — customers cannot book pickups that day');
      setHolidayOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.all });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the holiday');
    },
  });

  const removeHoliday = useMutation({
    mutationFn: (id: string) => del(`/retailer/holidays/${id}`),
    onSuccess: () => {
      toast.success('Holiday removed');
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.all });
    },
  });

  const uploadDocument = useMutation({
    mutationFn: () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choose a file');
      const data = new FormData();
      data.append('file', file);
      data.append('type', effectiveDocumentType);
      return upload('/retailer/documents', data);
    },
    onSuccess: () => {
      toast.success('Document uploaded for review');
      setUploadOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.profile });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Upload failed');
    },
  });

  const removeDocument = useMutation({
    mutationFn: (id: string) => del(`/retailer/documents/${id}`),
    onSuccess: () => {
      toast.success('Document removed');
      setDeletingDocument(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.profile });
    },
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Your browser cannot share a location');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void form.setFieldValue('latitude', position.coords.latitude.toFixed(7));
        void form.setFieldValue('longitude', position.coords.longitude.toFixed(7));
        toast.success('Location captured — save the profile to apply it');
      },
      () => toast.error('Could not read your location'),
    );
  };

  if (isLoading || !store) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Store profile"
        description="Your shopfront as customers see it, plus the licence details the platform verifies."
        action={
          <>
            <ApprovalBadge status={store.approvalStatus} />
            <Button
              variant={store.isTemporarilyClosed ? 'success' : 'outline'}
              loading={toggleClosure.isPending}
              onClick={() => toggleClosure.mutate(!store.isTemporarilyClosed)}
            >
              {store.isTemporarilyClosed ? 'Reopen store' : 'Close temporarily'}
            </Button>
          </>
        }
      />

      {store.isTemporarilyClosed ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm text-amber-900">
          Your store is marked temporarily closed. Customers cannot place new orders or book pickups.
        </div>
      ) : null}

      {!store.latitude || !store.longitude ? (
        <div className="mb-6 rounded-xl border border-blue-200 bg-info-soft px-4 py-3 text-sm text-blue-900">
          Your store has no map location, so it will not appear in nearby search. Add coordinates below.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Store details" />
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit}>
              <Input
                label="Store name"
                required
                className="sm:col-span-2"
                error={form.touched.storeName ? form.errors.storeName : undefined}
                {...form.getFieldProps('storeName')}
              />
              <Input label="Owner name" {...form.getFieldProps('ownerName')} />
              <Input
                label="Phone"
                error={form.touched.phone ? form.errors.phone : undefined}
                {...form.getFieldProps('phone')}
              />
              <Input
                label="Email"
                type="email"
                error={form.touched.email ? form.errors.email : undefined}
                {...form.getFieldProps('email')}
              />
              <Input
                label="GSTIN"
                placeholder="27AABCU9603R1ZX"
                error={form.touched.gstNumber ? form.errors.gstNumber : undefined}
                {...form.getFieldProps('gstNumber')}
              />
              <Input
                label="Drug licence number"
                className="sm:col-span-2"
                error={form.touched.drugLicenseNumber ? form.errors.drugLicenseNumber : undefined}
                {...form.getFieldProps('drugLicenseNumber')}
              />
              <Textarea
                label="About your store"
                className="sm:col-span-2"
                placeholder="Shown to customers browsing nearby stores"
                {...form.getFieldProps('description')}
              />

              <h3 className="sm:col-span-2 mt-2 text-sm font-semibold text-ink-800">Address</h3>
              <Input label="Address line 1" className="sm:col-span-2" {...form.getFieldProps('addressLine1')} />
              <Input label="Landmark" {...form.getFieldProps('landmark')} />
              <Input label="City" {...form.getFieldProps('city')} />
              <Input label="State" {...form.getFieldProps('state')} />
              <Input
                label="Pincode"
                error={form.touched.pincode ? form.errors.pincode : undefined}
                {...form.getFieldProps('pincode')}
              />

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

              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  icon={<Crosshair className="h-4 w-4" />}
                  onClick={useMyLocation}
                >
                  Use my current location
                </Button>
                <Button type="submit" loading={saveProfile.isPending}>
                  Save profile
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Business hours"
              description="These drive which pickup slots customers can choose."
              action={
                <Button size="sm" loading={saveHours.isPending} onClick={() => saveHours.mutate()}>
                  Save hours
                </Button>
              }
            />
            <ul className="divide-y divide-ink-100">
              {hours.map((hour, index) => (
                <li key={hour.dayOfWeek} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-28 text-sm font-medium text-ink-800">
                    {DAY_NAMES[hour.dayOfWeek]}
                  </span>

                  <Checkbox
                    label="Closed"
                    checked={hour.isClosed}
                    onChange={(event) =>
                      setHours((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, isClosed: event.target.checked } : row,
                        ),
                      )
                    }
                  />

                  {!hour.isClosed ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hour.openTime ?? '09:00'}
                        onChange={(event) =>
                          setHours((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, openTime: event.target.value } : row,
                            ),
                          )
                        }
                        className="rounded-lg border border-ink-300 px-2 py-1.5 text-sm"
                      />
                      <span className="text-ink-400">to</span>
                      <input
                        type="time"
                        value={hour.closeTime ?? '21:00'}
                        onChange={(event) =>
                          setHours((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, closeTime: event.target.value } : row,
                            ),
                          )
                        }
                        className="rounded-lg border border-ink-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Delivery"
              description="Offer delivery alongside pickup — customers choose at checkout, with pay-on-delivery (COD) as an option."
              action={
                <Button size="sm" loading={saveDelivery.isPending} onClick={() => saveDelivery.mutate()}>
                  Save
                </Button>
              }
            />
            <div className="space-y-4">
              <Checkbox
                label="This store offers delivery"
                checked={delivery.deliveryEnabled}
                onChange={(event) =>
                  setDeliveryDraft({ ...delivery, deliveryEnabled: event.target.checked })
                }
              />
              {delivery.deliveryEnabled ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Delivery charge"
                    type="number"
                    step="0.01"
                    min="0"
                    value={delivery.deliveryChargeAmount}
                    onChange={(event) =>
                      setDeliveryDraft({ ...delivery, deliveryChargeAmount: event.target.value })
                    }
                  />
                  <Input
                    label="Free delivery above (optional)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="No threshold"
                    value={delivery.deliveryFreeAboveAmount}
                    onChange={(event) =>
                      setDeliveryDraft({ ...delivery, deliveryFreeAboveAmount: event.target.value })
                    }
                    hint="Order value at or above which delivery is free. Leave blank for none."
                  />
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Holidays & closures"
              description="Days you will not be open. Pickup slots are disabled automatically."
              action={
                <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setHolidayOpen(true)}>
                  Add holiday
                </Button>
              }
            />
            {!holidays || holidays.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">No holidays scheduled.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {holidays.map((holiday) => (
                  <li key={holiday.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{formatDate(holiday.date)}</p>
                      <p className="text-xs text-ink-500">
                        {holiday.title ?? 'Holiday'}
                        {holiday.isFullDay
                          ? ' · closed all day'
                          : ` · open ${holiday.openTime} – ${holiday.closeTime}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove holiday"
                      onClick={() => removeHoliday.mutate(holiday.id)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader
            title="Licence documents"
            description="Required before your store goes live."
            action={
              <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
                Upload
              </Button>
            }
          />
          {!store.documents || store.documents.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {store.documents.map((document) => (
                <li key={document.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800">
                        {humanize(document.type)}
                      </p>
                      <p className="truncate text-xs text-ink-500">{document.fileName}</p>
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
                        onClick={() => setDeletingDocument(document)}
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
        <StaffManager basePath="/retailer" />
      </div>

      <div className="mt-4">
        <NotificationTemplateEditor
          basePath="/retailer"
          title="Notification messages"
          description="Customise the wording your customers get about their orders. Leave any event unset to use the platform default."
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
          <div>
            <label htmlFor="store-document" className="mb-1.5 block text-sm font-medium text-ink-700">
              File
            </label>
            <input
              id="store-document"
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-white"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={holidayOpen}
        onClose={() => setHolidayOpen(false)}
        title="Add a holiday"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setHolidayOpen(false)}>
              Cancel
            </Button>
            <Button loading={addHoliday.isPending} onClick={() => addHoliday.mutate()}>
              Save holiday
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            required
            min={todayISO()}
            value={holidayForm.date}
            onChange={(event) =>
              setHolidayForm((current) => ({ ...current, date: event.target.value }))
            }
          />
          <Input
            label="Reason"
            placeholder="Diwali, stock audit, staff leave…"
            value={holidayForm.title}
            onChange={(event) =>
              setHolidayForm((current) => ({ ...current, title: event.target.value }))
            }
          />
          <Checkbox
            label="Closed for the whole day"
            checked={holidayForm.isFullDay}
            onChange={(event) =>
              setHolidayForm((current) => ({ ...current, isFullDay: event.target.checked }))
            }
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingDocument)}
        onClose={() => setDeletingDocument(null)}
        onConfirm={() => deletingDocument && removeDocument.mutate(deletingDocument.id)}
        title="Remove document"
        message="You will need to upload this document again for verification."
        confirmLabel="Remove"
        loading={removeDocument.isPending}
      />
    </>
  );
}
