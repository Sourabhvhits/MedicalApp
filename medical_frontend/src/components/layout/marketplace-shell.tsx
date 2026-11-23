'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ClipboardList,
  LogOut,
  MapPin,
  Search,
  ShoppingCart,
  Stethoscope,
  Store,
  User,
} from 'lucide-react';
import { getOne } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { requestBrowserLocation, useLocationStore } from '@/store/location-store';
import type { CartSummary } from '@/lib/types';
import { Button, Modal, Input } from '@/components/ui';

const TABS = [
  { href: '/stores', label: 'Stores', icon: Store },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/cart', label: 'Cart', icon: ShoppingCart },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/profile', label: 'Profile', icon: User },
];

/**
 * Mobile-first marketplace chrome: a location-aware header, a desktop nav and
 * a thumb-reachable bottom bar on small screens.
 */
export function MarketplaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { coords, label, pincode, radiusKm, setRadius, setPincode, status } = useLocationStore();
  const [locationOpen, setLocationOpen] = useState(false);
  const [pincodeDraft, setPincodeDraft] = useState(pincode ?? '');

  const { data: cart } = useQuery({
    queryKey: queryKeys.customer.cart,
    queryFn: () => getOne<CartSummary | null>('/customers/cart'),
    enabled: Boolean(user),
  });

  const { data: unread } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => getOne<{ unreadCount: number }>('/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  const cartCount = cart?.totals.itemCount ?? 0;
  const locationLabel = pincode ? `Pincode ${pincode}` : (label ?? 'Set your location');

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/stores" className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span className="hidden text-base font-semibold text-ink-900 sm:block">MedMarket</span>
          </Link>

          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-ink-50 sm:flex-none"
          >
            <MapPin className="h-4 w-4 shrink-0 text-brand-700" />
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-ink-400">
                Delivering to
              </span>
              <span className="block truncate text-sm font-medium text-ink-800">
                {locationLabel}
                {coords ? <span className="text-ink-400"> · {radiusKm} km</span> : null}
              </span>
            </span>
          </button>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {TABS.filter((tab) => tab.href !== '/cart').map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname.startsWith(tab.href)
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-ink-600 hover:bg-ink-50',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            {user ? (
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-50"
              >
                <Bell className="h-5 w-5" />
                {unread && unread.unreadCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                    {unread.unreadCount > 9 ? '9+' : unread.unreadCount}
                  </span>
                ) : null}
              </Link>
            ) : null}

            <Link
              href="/cart"
              aria-label="Cart"
              className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-50"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-700 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>

            {user ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                className="hidden sm:inline-flex"
                onClick={async () => {
                  await logout();
                  router.replace('/login');
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            ) : (
              <Link href="/login">
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 md:pb-10">
        {children}
      </main>

      {/* Bottom navigation — mobile only */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white md:hidden">
        <ul className="mx-auto flex max-w-md">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = pathname.startsWith(tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors',
                    active ? 'text-brand-700' : 'text-ink-500',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                  {tab.href === '/cart' && cartCount > 0 ? (
                    <span className="absolute right-1/4 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-700 px-1 text-[10px] text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Modal
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        title="Set your location"
        description="We use this to find medical stores near you and estimate distance."
        size="sm"
      >
        <div className="space-y-4">
          <Button
            className="w-full"
            icon={<MapPin className="h-4 w-4" />}
            loading={status === 'locating'}
            onClick={async () => {
              const result = await requestBrowserLocation();
              if (result) {
                setLocationOpen(false);
              }
            }}
          >
            Use my current location
          </Button>

          {status === 'denied' ? (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-amber-900">
              Location permission was refused. Enter a pincode instead, or allow location access in
              your browser settings.
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-200" />
            <span className="text-xs text-ink-400">or</span>
            <span className="h-px flex-1 bg-ink-200" />
          </div>

          <div className="flex items-end gap-2">
            <Input
              label="Search by pincode"
              inputMode="numeric"
              placeholder="411001"
              value={pincodeDraft}
              onChange={(event) => setPincodeDraft(event.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => {
                if (!/^\d{6}$/.test(pincodeDraft)) return;
                setPincode(pincodeDraft);
                setLocationOpen(false);
              }}
            >
              Apply
            </Button>
          </div>

          <div>
            <label htmlFor="radius" className="mb-1.5 block text-sm font-medium text-ink-700">
              Search radius: {radiusKm} km
            </label>
            <input
              id="radius"
              type="range"
              min={1}
              max={25}
              step={1}
              value={radiusKm}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="w-full accent-brand-700"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
