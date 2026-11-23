'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, RotateCcw } from 'lucide-react';
import { ApiError, del, getOne, put } from '@/lib/api-client';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  LoadingBlock,
  Modal,
  Textarea,
} from '@/components/ui';

interface TemplateRow {
  event: string;
  isCustomized: boolean;
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
}

function eventLabel(event: string): string {
  return event
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Shared editor for TASKS.md #15 — lists the notification events this scope
 * (platform / a wholesaler / a medical shop) may customise the wording for,
 * with a per-event modal to set or reset its message. Mounted on
 * `/admin/settings` (platform defaults), `/vendor/profile` and
 * `/retailer/store` (each business's own override) against the same
 * `{basePath}/notification-templates` API.
 */
export function NotificationTemplateEditor({ basePath, title, description }: { basePath: string; title: string; description: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const queryKey = ['notification-templates', basePath] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getOne<TemplateRow[]>(`${basePath}/notification-templates`),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const save = useMutation({
    mutationFn: (input: { event: string; titleTemplate: string; bodyTemplate: string; isActive: boolean }) =>
      put(`${basePath}/notification-templates/${input.event}`, {
        titleTemplate: input.titleTemplate,
        bodyTemplate: input.bodyTemplate,
        isActive: input.isActive,
      }),
    onSuccess: () => {
      toast.success('Message updated');
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save the message'),
  });

  const reset = useMutation({
    mutationFn: (event: string) => del(`${basePath}/notification-templates/${event}`),
    onSuccess: () => {
      toast.success('Reset to the built-in message');
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not reset this message'),
  });

  return (
    <Card>
      <CardHeader title={title} description={description} />

      {isLoading || !data ? (
        <LoadingBlock />
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.map((row) => (
            <li key={row.event} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">{eventLabel(row.event)}</p>
                <p className="truncate text-xs text-ink-500">
                  {row.isCustomized ? row.titleTemplate : 'Using the built-in message'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.isCustomized ? <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Custom' : 'Disabled'}</Badge> : null}
                <Button
                  size="sm"
                  variant="outline"
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  onClick={() => setEditing(row)}
                >
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TemplateModal
        row={editing}
        saving={save.isPending}
        resetting={reset.isPending}
        onClose={() => setEditing(null)}
        onSave={(input) => save.mutate(input)}
        onReset={(event) => reset.mutate(event)}
      />
    </Card>
  );
}

function TemplateModal({
  row,
  saving,
  resetting,
  onClose,
  onSave,
  onReset,
}: {
  row: TemplateRow | null;
  saving: boolean;
  resetting: boolean;
  onClose: () => void;
  onSave: (input: { event: string; titleTemplate: string; bodyTemplate: string; isActive: boolean }) => void;
  onReset: (event: string) => void;
}) {
  const [titleTemplate, setTitleTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Re-seed whenever a different row opens.
  const key = row?.event ?? '';
  const [seededFor, setSeededFor] = useState('');
  if (row && seededFor !== key) {
    setTitleTemplate(row.titleTemplate);
    setBodyTemplate(row.bodyTemplate);
    setIsActive(row.isActive);
    setSeededFor(key);
  }

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title={row ? eventLabel(row.event) : ''}
      description="Use {{placeholders}} such as {{orderNumber}} or {{storeName}} — they're filled in when the message is sent."
      size="md"
      footer={
        <>
          {row?.isCustomized ? (
            <Button
              variant="outline"
              icon={<RotateCcw className="h-4 w-4" />}
              loading={resetting}
              onClick={() => row && onReset(row.event)}
            >
              Reset to default
            </Button>
          ) : null}
          <Button
            loading={saving}
            disabled={!titleTemplate.trim() || !bodyTemplate.trim()}
            onClick={() => row && onSave({ event: row.event, titleTemplate, bodyTemplate, isActive })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          value={titleTemplate}
          onChange={(event) => setTitleTemplate(event.target.value)}
          placeholder="e.g. Your order {{orderNumber}} is ready"
        />
        <Textarea
          label="Message"
          value={bodyTemplate}
          onChange={(event) => setBodyTemplate(event.target.value)}
          rows={4}
          placeholder="e.g. Your order {{orderNumber}} can be collected from {{storeName}}."
        />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-ink-300 text-brand-700 accent-brand-700"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Active — leave unchecked to keep it saved but temporarily fall back to the built-in message
        </label>
      </div>
    </Modal>
  );
}
