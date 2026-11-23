'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  CalendarClock,
  ClipboardList,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Store,
  Truck,
} from 'lucide-react';
import { HOME_ROUTE, useAuthStore } from '@/store/auth-store';
import { requestBrowserLocation, useLocationStore } from '@/store/location-store';
import { getList } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { distanceLabel } from '@/lib/utils';
import type { PaginatedResponse, StoreSummary } from '@/lib/types';
import { Badge, Button, Input } from '@/components/ui';

const AUDIENCES = [
  {
    icon: <MapPin className="h-5 w-5" />,
    title: 'Customers',
    body: 'Find medical stores near you, check live availability, reserve what you need and pick it up in a slot that suits you.',
    href: '/stores',
    cta: 'Browse nearby stores',
  },
  {
    icon: <Stethoscope className="h-5 w-5" />,
    title: 'Medical shops',
    body: 'Run your storefront, batch-wise stock, expiry alerts, purchase orders and customer pickups from one dashboard.',
    href: '/register?type=RETAILER',
    cta: 'Register your shop',
  },
  {
    icon: <Truck className="h-5 w-5" />,
    title: 'Wholesalers',
    body: 'List your catalogue, receive orders from retailers, dispatch with batch details and track payments.',
    href: '/register?type=VENDOR',
    cta: 'Register as a vendor',
  },
];

const FEATURES = [
  {
    icon: <Boxes className="h-5 w-5" />,
    title: 'Batch-wise inventory',
    body: 'Every movement writes an inventory transaction. Stock is consumed first-expiry-first-out, and expired batches can never be sold.',
  },
  {
    icon: <CalendarClock className="h-5 w-5" />,
    title: 'Pickup slot control',
    body: 'Stores define opening hours, holidays, slot length and capacity. Customers can only pick slots that are genuinely available.',
  },
  {
    icon: <ClipboardList className="h-5 w-5" />,
    title: 'Finance and compliance',
    body: 'GST-accurate invoicing, profit and loss from real batch costs, expiry reporting and a full audit trail of every action.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Verified businesses only',
    body: 'Drug licence and GST documents are reviewed by the platform before a vendor or shop can trade.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { user, initialised } = useAuthStore();
  const { coords, pincode, radiusKm, status, setPincode } = useLocationStore();
  const [pincodeDraft, setPincodeDraft] = useState('');

  // Signed-in users go straight to their workspace.
  useEffect(() => {
    if (initialised && user) router.replace(HOME_ROUTE[user.userType]);
  }, [initialised, user, router]);

  const hasLocation = Boolean(coords || pincode);

  // Same nearby-store discovery endpoint /stores uses — a small preview here,
  // not a replacement for the full page (see TASKS.md #0b).
  const { data: nearby, isLoading: loadingNearby, error: nearbyError } = useQuery<
    PaginatedResponse<StoreSummary>
  >({
    queryKey: queryKeys.customer.nearbyStores({
      preview: true,
      limit: 4,
      sortBy: 'distance',
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, radius: radiusKm } : {}),
      ...(pincode ? { pincode } : {}),
    }),
    queryFn: () =>
      getList<StoreSummary>('/customers/stores/nearby', {
        page: 1,
        limit: 4,
        sortBy: 'distance',
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, radius: radiusKm } : {}),
        ...(pincode ? { pincode } : {}),
      }),
    enabled: hasLocation,
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-ink-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold text-ink-900">MedMarket</span>
          </span>
          <nav className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Create account</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
              B2B wholesale + B2C pickup marketplace
            </span>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-ink-900 sm:text-5xl">
              Medicines, from wholesaler to counter to customer.
            </h1>
            <p className="mt-5 text-base text-ink-600 sm:text-lg">
              One platform connecting medical wholesalers, retail pharmacies and the people they
              serve — with the stock, batch, expiry and compliance controls the medicine trade
              actually needs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg" variant="outline">
                  Register a business
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-8 max-w-2xl rounded-xl border border-ink-200 bg-ink-50 p-5">
            <h2 className="text-sm font-semibold text-ink-900">Find a medical store near you</h2>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Button
                icon={<MapPin className="h-4 w-4" />}
                loading={status === 'locating'}
                onClick={() => void requestBrowserLocation()}
              >
                Use my location
              </Button>
              <span className="text-xs text-ink-400">or</span>
              <Input
                aria-label="Pincode"
                inputMode="numeric"
                placeholder="Enter pincode"
                value={pincodeDraft}
                onChange={(event) => setPincodeDraft(event.target.value)}
                className="w-36"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (/^\d{6}$/.test(pincodeDraft)) setPincode(pincodeDraft);
                }}
              >
                Search
              </Button>
            </div>

            {hasLocation ? (
              <div className="mt-5">
                {loadingNearby ? (
                  <p className="text-sm text-ink-500">Looking for stores near you…</p>
                ) : nearbyError ? (
                  <p className="text-sm text-danger">
                    Couldn&apos;t load nearby stores right now — try{' '}
                    <Link href="/stores" className="underline">
                      the full stores page
                    </Link>
                    .
                  </p>
                ) : !nearby || nearby.data.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    No approved stores found here yet. Try a different pincode.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {nearby.data.map((store) => (
                      <Link
                        key={store.id}
                        href={`/stores/${store.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2.5 transition-colors hover:border-brand-300"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {store.storeName}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                            <Store className="h-3 w-3" />
                            {store.distanceKm !== null ? distanceLabel(store.distanceKm) : '—'}
                          </p>
                        </div>
                        <Badge tone={store.isOpen ? 'success' : 'neutral'}>
                          {store.isOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <Link
              href="/stores"
              className="mt-4 inline-block text-xs font-medium text-brand-700 hover:underline"
            >
              See all stores →
            </Link>
          </div>
        </section>

        <section className="border-y border-ink-200 bg-ink-50">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <div
                key={audience.title}
                className="flex flex-col rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  {audience.icon}
                </span>
                <h2 className="mt-4 text-base font-semibold text-ink-900">{audience.title}</h2>
                <p className="mt-2 flex-1 text-sm text-ink-600">{audience.body}</p>
                <Link href={audience.href} className="mt-5">
                  <Button variant="outline" size="sm" className="w-full">
                    {audience.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-ink-900">Built for how pharmacies really work</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  {feature.icon}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">{feature.title}</h3>
                  <p className="mt-1 text-sm text-ink-600">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-ink-500 sm:px-6">
          <p>
            Medicines are dispensed by licensed medical shops. Prescription-only products require a
            valid prescription at pickup.
          </p>
        </div>
      </footer>
    </div>
  );
}
