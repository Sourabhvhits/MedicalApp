'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Stethoscope, X } from 'lucide-react';
import { getOne } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, initials } from '@/lib/utils';
import { HOME_ROUTE, useAuthStore } from '@/store/auth-store';
import type { UserType } from '@/lib/types';
import { Badge, Button, LoadingBlock } from '@/components/ui';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Hides the entry unless the signed-in user holds this permission. */
  permission?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

interface DashboardShellProps {
  children: ReactNode;
  sections: NavSection[];
  allow: UserType[];
  brandLabel: string;
  /** Rendered in the top bar, left of the notification bell — e.g. admin's global search. */
  topBarExtra?: ReactNode;
}

export function DashboardShell({ children, sections, allow, brandLabel, topBarExtra }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, initialised, can, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Route guard: wait for session restore, then enforce the account type.
  useEffect(() => {
    if (!initialised) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!allow.includes(user.userType)) {
      router.replace(HOME_ROUTE[user.userType]);
    }
  }, [initialised, user, allow, router, pathname]);

  const { data: unread } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: () => getOne<{ unreadCount: number }>('/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  if (!initialised || !user || !allow.includes(user.userType)) {
    return <LoadingBlock label="Loading your workspace…" />;
  }

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || can(item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  const isActive = (href: string) =>
    pathname === href || (href !== HOME_ROUTE[user.userType] && pathname.startsWith(`${href}/`));

  const navigation = (
    <nav className="scroll-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {visibleSections.map((section, index) => (
        <div key={section.title ?? index}>
          {section.title ? (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {section.title}
            </p>
          ) : null}
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-brand-700 text-white'
                      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
        <Link href={HOME_ROUTE[user.userType]} className="flex items-center gap-2.5 border-b border-ink-200 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">
            <Stethoscope className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink-900">MedMarket</span>
            <span className="block text-xs text-ink-500">{brandLabel}</span>
          </span>
        </Link>
        {navigation}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
              <span className="text-sm font-semibold text-ink-900">MedMarket</span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="h-5 w-5 text-ink-500" />
              </button>
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {topBarExtra}

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {user.approvalStatus && user.approvalStatus !== 'APPROVED' ? (
              <Badge tone="warning">Account {user.approvalStatus.toLowerCase().replace('_', ' ')}</Badge>
            ) : null}

            <Link
              href="/notifications"
              className="relative rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-100"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread && unread.unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {unread.unreadCount > 99 ? '99+' : unread.unreadCount}
                </span>
              ) : null}
            </Link>

            <div className="flex items-center gap-2 rounded-lg px-2 py-1">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">
                {initials(user.firstName, user.lastName)}
              </span>
              <span className="hidden text-sm sm:block">
                <span className="block font-medium text-ink-800">
                  {user.firstName} {user.lastName ?? ''}
                </span>
                <span className="block text-xs text-ink-500">{user.email ?? user.phone}</span>
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
