import type { BroadcastSegment, NotificationChannel } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { buildMeta } from '../../utils/response';
import { getPagination } from '../../utils/pagination';
import { notify } from './notification.service';

const SEGMENT_USER_TYPES: Record<BroadcastSegment, readonly ('VENDOR' | 'RETAILER' | 'CUSTOMER')[]> = {
  ALL_VENDORS: ['VENDOR'],
  ALL_RETAILERS: ['RETAILER'],
  ALL_CUSTOMERS: ['CUSTOMER'],
  EVERYONE: ['VENDOR', 'RETAILER', 'CUSTOMER'],
};

/**
 * Fans out one message to every active user in a segment — same
 * per-recipient `notify()` loop `notifyAdmins()` already uses, just over a
 * larger, admin-chosen audience. No queue exists yet (TASKS.md #37), so this
 * runs in-process; fine at today's scale, revisit once a real job queue
 * lands rather than building a bespoke one here.
 */
export async function sendBroadcast(
  input: { segment: BroadcastSegment; title: string; body: string; channels: NotificationChannel[] },
  sentById: string,
) {
  const recipients = await prisma.user.findMany({
    where: { userType: { in: [...SEGMENT_USER_TYPES[input.segment]] }, status: 'ACTIVE' },
    select: { id: true },
  });

  await Promise.all(
    recipients.map((recipient) =>
      notify({
        userId: recipient.id,
        event: 'admin.broadcast',
        title: input.title,
        body: input.body,
        channels: input.channels,
      }),
    ),
  );

  return prisma.broadcast.create({
    data: {
      segment: input.segment,
      title: input.title,
      body: input.body,
      channels: input.channels,
      recipientCount: recipients.length,
      sentById,
    },
  });
}

export async function listBroadcasts(query: Record<string, unknown>) {
  const { page, limit, skip, take } = getPagination(query);

  const [items, total] = await Promise.all([
    prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.broadcast.count(),
  ]);

  return { items, meta: buildMeta(page, limit, total) };
}
