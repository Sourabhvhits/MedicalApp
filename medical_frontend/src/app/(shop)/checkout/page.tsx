'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CalendarClock, Check, FileUp, MapPin, Store, Truck } from 'lucide-react';
import { ApiError, getOne, post, upload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, currency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { CartSummary, CustomerAddressRecord, Order, PickupSlot, SlotCalendarDay } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Select,
  Textarea,
} from '@/components/ui';

interface StoreDeliveryInfo {
  deliveryEnabled: boolean;
  deliveryChargeAmount: number | string;
  deliveryFreeAboveAmount: number | string | null;
}

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, initialised } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  // Null means "not chosen yet" — the first bookable day is used until then.
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<PickupSlot | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [deliveryAddressId, setDeliveryAddressId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [note, setNote] = useState('');
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);

  const { data: cart, isLoading } = useQuery({
    queryKey: queryKeys.customer.cart,
    queryFn: () => getOne<CartSummary | null>('/customers/cart'),
    enabled: Boolean(user),
  });

  // "Pay online" only appears once a real gateway is configured server-side —
  // see backend/src/lib/payment-gateway.ts (TASKS.md #2). No widget-launch
  // code lives here yet since that's specific to whichever provider is wired.
  const { data: publicConfig } = useQuery({
    queryKey: ['config', 'public'],
    queryFn: () => getOne<{ onlinePaymentEnabled: boolean }>('/config/public'),
  });

  const retailerId = cart?.cart?.retailerId;

  const { data: calendar, isLoading: loadingSlots } = useQuery({
    queryKey: queryKeys.customer.storeSlots(retailerId ?? '', 'calendar'),
    queryFn: () => getOne<SlotCalendarDay[]>(`/customers/stores/${retailerId}/pickup-slots`, { days: 7 }),
    enabled: Boolean(retailerId) && fulfillmentType === 'PICKUP',
  });

  // Whether this store offers delivery at all, and its charge — used to show
  // the Delivery tab and preview a delivery charge before placing the order
  // (the actual charge is always recomputed authoritatively server-side).
  const { data: storeInfo } = useQuery({
    queryKey: queryKeys.customer.store(retailerId ?? ''),
    queryFn: () => getOne<StoreDeliveryInfo>(`/customers/stores/${retailerId}`),
    enabled: Boolean(retailerId),
  });

  const { data: addresses } = useQuery({
    queryKey: queryKeys.customer.addresses,
    queryFn: () => getOne<CustomerAddressRecord[]>('/customers/addresses'),
    enabled: fulfillmentType === 'DELIVERY',
  });

  // Seed the default (or first) saved address once the list loads, without
  // fighting the customer's own later selection.
  if (addresses && addresses.length > 0 && !deliveryAddressId) {
    setDeliveryAddressId((addresses.find((address) => address.isDefault) ?? addresses[0]).id);
  }

  const firstBookable = calendar?.find((day) => !day.isClosed && day.availableCount > 0);
  const pickupDate = chosenDate ?? firstBookable?.date ?? '';

  const selectDay = (date: string) => {
    setChosenDate(date);
    // A slot only makes sense for the day it belongs to.
    setSlot(null);
  };

  const deliveryChargePreview = (() => {
    if (fulfillmentType !== 'DELIVERY' || !storeInfo?.deliveryEnabled || !cart) return 0;
    const freeAbove = storeInfo.deliveryFreeAboveAmount;
    if (freeAbove !== null && cart.totals.subtotal >= Number(freeAbove)) return 0;
    return Number(storeInfo.deliveryChargeAmount);
  })();

  const uploadPrescription = useMutation({
    mutationFn: () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choose a file');
      const data = new FormData();
      data.append('file', file);
      return upload<{ url: string }>('/customers/prescriptions', data);
    },
    onSuccess: (result) => {
      setPrescriptionUrl(result.url);
      toast.success('Prescription uploaded');
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Upload failed');
    },
  });

  const placeOrder = useMutation({
    mutationFn: () =>
      post<Order>('/customers/orders', {
        fulfillmentType,
        ...(fulfillmentType === 'PICKUP'
          ? { pickupDate, pickupStartTime: slot!.startTime }
          : { deliveryAddressId: deliveryAddressId! }),
        paymentMode,
        customerNote: note || undefined,
        prescriptionUrl: prescriptionUrl ?? undefined,
      }),
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} placed`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.all });
      router.replace(`/orders/${order.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not place the order');
    },
  });

  if (!initialised || isLoading) return <LoadingBlock />;

  if (!user) {
    return (
      <EmptyState
        title="Sign in to check out"
        action={
          <Link href="/login?next=/checkout">
            <Button>Sign in</Button>
          </Link>
        }
      />
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add items to your cart before checking out."
        action={
          <Link href="/stores">
            <Button>Browse stores</Button>
          </Link>
        }
      />
    );
  }

  const selectedDay = calendar?.find((day) => day.date === pickupDate);
  const needsPrescription = cart.requiresPrescription && !prescriptionUrl;
  const fulfillmentReady =
    fulfillmentType === 'PICKUP' ? Boolean(slot) : Boolean(deliveryAddressId);
  const canPlace = fulfillmentReady && !needsPrescription && cart.issues.length === 0;

  return (
    <>
      <Link
        href="/cart"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cart
      </Link>

      <h1 className="mb-1 text-xl font-semibold text-ink-900 sm:text-2xl">Checkout</h1>
      <p className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-500">
        <Store className="h-4 w-4" />
        {fulfillmentType === 'PICKUP' ? 'Collecting from' : 'Ordering from'} {cart.cart?.retailer.storeName}
      </p>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {storeInfo?.deliveryEnabled ? (
            <div className="inline-flex rounded-lg border border-ink-200 bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setFulfillmentType('PICKUP');
                  setPaymentMode('CASH');
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  fulfillmentType === 'PICKUP' ? 'bg-brand-700 text-white' : 'text-ink-600 hover:bg-ink-50',
                )}
              >
                <Store className="h-3.5 w-3.5" />
                Pickup
              </button>
              <button
                type="button"
                onClick={() => {
                  setFulfillmentType('DELIVERY');
                  setPaymentMode('COD');
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  fulfillmentType === 'DELIVERY' ? 'bg-brand-700 text-white' : 'text-ink-600 hover:bg-ink-50',
                )}
              >
                <Truck className="h-3.5 w-3.5" />
                Delivery
              </button>
            </div>
          ) : null}

          {fulfillmentType === 'PICKUP' ? (
          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <CalendarClock className="h-4 w-4 text-brand-700" />
              Pick a collection day
            </h2>
            <p className="mb-4 text-xs text-ink-500">
              Only days the store is open, with slots still free, can be selected.
            </p>

            {loadingSlots ? (
              <LoadingBlock label="Loading available slots…" />
            ) : !calendar || calendar.every((day) => day.availableCount === 0) ? (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-amber-900">
                This store has no pickup slots available in the next week. Try another store, or
                contact them directly.
              </p>
            ) : (
              <>
                <div className="scroll-thin -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
                  {calendar.map((day) => {
                    const disabled = day.isClosed || day.availableCount === 0;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={disabled}
                        onClick={() => selectDay(day.date)}
                        className={cn(
                          'min-w-24 shrink-0 rounded-lg border px-3 py-2 text-center transition-colors',
                          pickupDate === day.date
                            ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                            : disabled
                              ? 'cursor-not-allowed border-ink-200 bg-ink-100 text-ink-400'
                              : 'border-ink-200 bg-white hover:border-brand-300',
                        )}
                      >
                        <span className="block text-xs">{formatDate(day.date, 'EEE')}</span>
                        <span className="block text-sm font-semibold">
                          {formatDate(day.date, 'dd MMM')}
                        </span>
                        <span className="mt-0.5 block text-[11px]">
                          {day.isClosed
                            ? 'Closed'
                            : day.availableCount > 0
                              ? `${day.availableCount} slots`
                              : 'Full'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedDay && !selectedDay.isClosed ? (
                  <>
                    <h3 className="mb-2 text-sm font-semibold text-ink-900">
                      Choose a time on {formatDate(selectedDay.date, 'EEEE dd MMM')}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {selectedDay.slots.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!option.available}
                          title={option.reason}
                          onClick={() => setSlot(option)}
                          className={cn(
                            'rounded-lg border px-2 py-2 text-sm transition-colors',
                            slot?.id === option.id
                              ? 'border-brand-600 bg-brand-700 text-white'
                              : option.available
                                ? 'border-ink-200 bg-white hover:border-brand-300'
                                : 'cursor-not-allowed border-ink-200 bg-ink-100 text-ink-400',
                          )}
                        >
                          {option.startTime}
                          <span className="block text-[11px] opacity-80">
                            {option.available
                              ? `${option.capacity - option.bookedCount} left`
                              : (option.reason ?? 'Unavailable')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </Card>
          ) : (
          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <MapPin className="h-4 w-4 text-brand-700" />
              Delivery address
            </h2>
            <p className="mb-4 text-xs text-ink-500">
              Choose where this order should be delivered.
            </p>

            {!addresses || addresses.length === 0 ? (
              <div className="rounded-lg bg-warning-soft px-3 py-3 text-sm text-amber-900">
                No saved addresses yet.{' '}
                <Link href="/profile" className="font-medium underline">
                  Add one on your profile
                </Link>{' '}
                to deliver here.
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => setDeliveryAddressId(address.id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                      deliveryAddressId === address.id
                        ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                        : 'border-ink-200 bg-white hover:border-brand-300',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-ink-900">
                      {address.label ?? 'Address'}
                      {address.isDefault ? <Badge tone="brand">Default</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-600">
                      {[address.addressLine1, address.landmark, address.city, address.pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                    {address.contactPhone ? (
                      <span className="mt-0.5 block text-xs text-ink-500">{address.contactPhone}</span>
                    ) : null}
                  </button>
                ))}
                <Link href="/profile" className="inline-block text-xs font-medium text-brand-700 underline">
                  Add another address
                </Link>
              </div>
            )}
          </Card>
          )}

          {cart.interactionWarnings.length > 0 ? (
            <Card className="border-danger">
              <h2 className="mb-1 text-sm font-semibold text-red-900">Possible interaction</h2>
              {cart.interactionWarnings.map((warning) => (
                <p key={`${warning.compositionA}-${warning.compositionB}`} className="text-xs text-red-800">
                  {warning.compositionA} + {warning.compositionB}: {warning.description}
                </p>
              ))}
              <p className="mt-2 text-xs text-ink-500">
                This is informational only, not a substitute for professional medical advice.
              </p>
            </Card>
          ) : null}

          {cart.requiresPrescription ? (
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-ink-900">Prescription</h2>
              <p className="mb-3 text-xs text-ink-500">
                {cart.interactionWarnings.some((w) => w.severity === 'SEVERE')
                  ? 'This order combines medicines with a known severe interaction. Upload a prescription so the pharmacist can review it before accepting.'
                  : 'Your cart contains prescription-only medicines. Upload a clear photo or scan — the pharmacist will verify the original when you collect.'}
              </p>

              {prescriptionUrl ? (
                <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800">
                  <Check className="h-4 w-4" />
                  Prescription uploaded
                  <a
                    href={prescriptionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto font-medium underline"
                  >
                    View
                  </a>
                </p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-white"
                  />
                  <Button
                    icon={<FileUp className="h-4 w-4" />}
                    loading={uploadPrescription.isPending}
                    onClick={() => uploadPrescription.mutate()}
                  >
                    Upload
                  </Button>
                </div>
              )}
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Payment & notes</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Payment method"
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
                hint={
                  paymentMode === 'ONLINE'
                    ? "You'll be redirected to pay after placing the order"
                    : paymentMode === 'COD'
                      ? 'Pay in cash when your order arrives'
                      : 'Payment is collected at the store'
                }
                options={
                  fulfillmentType === 'PICKUP'
                    ? [
                        { value: 'CASH', label: 'Cash at the store' },
                        { value: 'UPI', label: 'UPI at the store' },
                        { value: 'CARD', label: 'Card at the store' },
                        ...(publicConfig?.onlinePaymentEnabled
                          ? [{ value: 'ONLINE', label: 'Pay online now' }]
                          : []),
                      ]
                    : [
                        { value: 'COD', label: 'Cash on delivery' },
                        ...(publicConfig?.onlinePaymentEnabled
                          ? [{ value: 'ONLINE', label: 'Pay online now' }]
                          : []),
                      ]
                }
              />
              <Textarea
                label="Note for the pharmacist"
                placeholder="Anything they should know"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-1">
          <Card className="sticky top-24">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Order summary</h2>

            <ul className="mb-3 space-y-2 text-sm">
              {cart.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="min-w-0 text-ink-700">
                    <span className="block truncate">{item.name}</span>
                    <span className="text-xs text-ink-500">× {item.quantity}</span>
                  </span>
                  <span className="tabular-nums text-ink-800">{currency(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-1.5 border-t border-ink-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Taxable value</dt>
                <dd className="tabular-nums">{currency(cart.totals.taxableAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">CGST + SGST</dt>
                <dd className="tabular-nums">{currency(cart.totals.taxAmount)}</dd>
              </div>
              {fulfillmentType === 'DELIVERY' ? (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Delivery charge</dt>
                  <dd className="tabular-nums">
                    {deliveryChargePreview > 0 ? currency(deliveryChargePreview) : 'Free'}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{currency(cart.totals.totalAmount + deliveryChargePreview)}</dd>
              </div>
            </dl>

            {fulfillmentType === 'PICKUP' ? (
              slot ? (
                <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
                  <Badge tone="brand">Pickup</Badge>
                  <span className="mt-1 block font-medium">
                    {formatDate(pickupDate, 'EEE dd MMM')}, {slot.startTime} – {slot.endTime}
                  </span>
                </p>
              ) : (
                <p className="mt-4 text-xs text-ink-500">Select a pickup day and time to continue.</p>
              )
            ) : deliveryAddressId ? (
              <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
                <Badge tone="brand">Delivery</Badge>
                <span className="mt-1 block font-medium">
                  {addresses?.find((address) => address.id === deliveryAddressId)?.addressLine1}
                </span>
              </p>
            ) : (
              <p className="mt-4 text-xs text-ink-500">Choose a delivery address to continue.</p>
            )}

            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={!canPlace}
              loading={placeOrder.isPending}
              onClick={() => placeOrder.mutate()}
            >
              Place order
            </Button>

            {needsPrescription ? (
              <p className="mt-2 text-center text-xs text-warning">
                Upload your prescription to continue
              </p>
            ) : null}

            <p className="mt-3 text-center text-[11px] text-ink-500">
              {fulfillmentType === 'PICKUP'
                ? 'Placing the order reserves your medicines. Collect within your slot — the store will contact you if anything changes.'
                : 'Placing the order reserves your medicines. The store will contact you once your order is out for delivery.'}
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
