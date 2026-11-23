'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { getList, patch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, humanize, relativeTime } from '@/lib/utils';
import { HOME_ROUTE, useAuthStore } from '@/store/auth-store';
import type { Notification, PaginatedResponse } from '@/lib/types';
import { Button, Card, EmptyState, LoadingBlock, PageHeader, SkeletonRows } from '@/components/ui';

/** Maps a notification event to the screen it refers to, per account type. */
function targetHref(event: string, userType: string | undefined): string | null {
  if (event.startsWith('order.')) {
    if (userType === 'CUSTOMER') return '/orders';
    if (userType === 'RETAILER') return '/retailer/orders';
  }
  if (event.startsWith('purchase.')) {
    return userType === 'VENDOR' ? '/vendor/orders' : '/retailer/purchases';
  }
  if (event.startsWith('stock.')) {
    return userType === 'VENDOR' ? '/vendor/inventory' : '/retailer/inventory';
  }
  if (event.startsWith('vendor.')) return userType === 'VENDOR' ? '/vendor/profile' : '/admin/vendors';
  if (event.startsWith('retailer.')) return userType === 'RETAILER' ? '/retailer/store' : '/admin/retailers';
  if (event === 'user.registered') return '/admin/vendors';
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, initialised } = useAuthStore();

  useEffect(() => {
    if (initialised && !user) router.replace('/login?next=/notifications');
  }, [initialised, user, router]);

  const { data, isLoading } = useQuery<PaginatedResponse<Notification> & { unreadCount?: number }>({
    queryKey: queryKeys.notifications.list({ limit: 50 }),
    queryFn: () => getList<Notification>('/notifications', { limit: 50 }),
    enabled: Boolean(user),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => patch(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => patch('/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  if (!initialised || !user) return <LoadingBlock />;

  const unread = data?.data.filter((item) => !item.readAt).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href={HOME_ROUTE[user.userType]}
        className="mb-4 inline-block text-sm font-medium text-ink-600 hover:text-brand-700"
      >
        ← Back
      </Link>

      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'You are all caught up'}
        action={
          unread > 0 ? (
            <Button
              variant="outline"
              size="sm"
              icon={<Check className="h-4 w-4" />}
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <SkeletonRows rows={5} columns={1} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title="No notifications yet"
          description="Order updates, approvals, stock and expiry alerts will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {data.data.map((notification) => {
            const href = targetHref(notification.event, user.userType);
            const content = (
              <Card
                className={cn(
                  'transition-colors',
                  notification.readAt ? 'bg-white' : 'border-brand-200 bg-brand-50/40',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{notification.title}</p>
                    <p className="mt-0.5 text-sm text-ink-600">{notification.body}</p>
                    <p className="mt-1.5 text-xs text-ink-400">
                      {humanize(notification.event.split('.')[0])} ·{' '}
                      {relativeTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.readAt ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.preventDefault();
                        markRead.mutate(notification.id);
                      }}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </Card>
            );

            return (
              <li key={notification.id}>
                {href ? (
                  <Link href={href} onClick={() => !notification.readAt && markRead.mutate(notification.id)}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
