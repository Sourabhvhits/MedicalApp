'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { ApiError, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useListQuery } from '@/hooks/use-list';
import { formatDateTime, humanize } from '@/lib/utils';
import type { Broadcast } from '@/lib/types';
import { Badge, Button, Card, CardHeader, Checkbox, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { DataTable, type Column } from '@/components/ui/data-table';

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS'] as const;

export default function AdminBroadcastsPage() {
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<Broadcast['segment']>('ALL_CUSTOMERS');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<string[]>(['IN_APP']);

  const list = useListQuery<Broadcast>('/admin/broadcasts', queryKeys.admin.broadcasts);

  const send = useMutation({
    mutationFn: () => post<Broadcast>('/admin/broadcasts', { segment, title, body, channels }),
    onSuccess: (result) => {
      toast.success(`Sent to ${result.recipientCount} recipients`);
      setTitle('');
      setBody('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.broadcasts({}) });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not send the broadcast');
    },
  });

  const toggleChannel = (channel: string) => {
    setChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    );
  };

  const columns: Column<Broadcast>[] = [
    {
      key: 'message',
      header: 'Message',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-ink-900">{row.title}</p>
          <p className="max-w-md truncate text-xs text-ink-500">{row.body}</p>
        </div>
      ),
    },
    {
      key: 'segment',
      header: 'Segment',
      render: (row) => <Badge tone="brand">{humanize(row.segment)}</Badge>,
    },
    {
      key: 'channels',
      header: 'Channels',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-ink-700">{row.channels.join(', ')}</span>,
    },
    {
      key: 'recipients',
      header: 'Recipients',
      render: (row) => <span className="text-sm tabular-nums text-ink-800">{row.recipientCount}</span>,
    },
    {
      key: 'sent',
      header: 'Sent',
      render: (row) => <span className="text-xs text-ink-500">{formatDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Broadcasts"
        description="Send a message to every wholesaler, medical shop or customer at once."
      />

      <Card className="mb-6">
        <CardHeader title="Compose" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Send to"
            value={segment}
            onChange={(event) => setSegment(event.target.value as Broadcast['segment'])}
            options={[
              { value: 'ALL_CUSTOMERS', label: 'All customers' },
              { value: 'ALL_VENDORS', label: 'All wholesalers' },
              { value: 'ALL_RETAILERS', label: 'All medical shops' },
              { value: 'EVERYONE', label: 'Everyone' },
            ]}
          />
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <Textarea
            label="Message"
            className="sm:col-span-2"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-ink-700">Channels</p>
            <div className="flex flex-wrap gap-4">
              {CHANNELS.map((channel) => (
                <Checkbox
                  key={channel}
                  label={humanize(channel)}
                  checked={channels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            icon={<Send className="h-4 w-4" />}
            loading={send.isPending}
            onClick={() => {
              if (title.trim().length < 3 || body.trim().length < 3) {
                toast.error('Add a title and message');
                return;
              }
              if (channels.length === 0) {
                toast.error('Choose at least one channel');
                return;
              }
              send.mutate();
            }}
          >
            Send broadcast
          </Button>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(row) => row.id}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        meta={list.meta}
        onPageChange={list.setPage}
        emptyTitle="No broadcasts sent yet"
        emptyDescription="Messages you send will appear here."
      />
    </>
  );
}
