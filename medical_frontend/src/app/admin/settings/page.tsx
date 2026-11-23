'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { getOne, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { Button, Card, CardHeader, Checkbox, Input, LoadingBlock, PageHeader } from '@/components/ui';
import { NotificationTemplateEditor } from '@/components/notification-template-editor';
import { ProviderCredentialsEditor } from '@/components/provider-credentials-editor';

interface Setting {
  id: string;
  key: string;
  value: string;
  group: string;
  dataType: string;
  label: string | null;
  isPublic: boolean;
}

const GROUP_TITLES: Record<string, { title: string; description: string }> = {
  general: { title: 'General', description: 'Platform identity and support contacts.' },
  order: { title: 'Orders & discovery', description: 'Search radius and order lifecycle rules.' },
  inventory: { title: 'Inventory', description: 'Stock consumption policy and expiry alerting.' },
  tax: { title: 'Tax', description: 'How GST is applied to retail and wholesale prices.' },
  security: { title: 'Security', description: 'Rate-limit thresholds and IPs exempt from them.' },
};

export default function AdminSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.settings,
    queryFn: () => getOne<Setting[]>('/admin/settings'),
  });

  if (isLoading || !data) return <LoadingBlock />;

  // Keyed on the loaded values so the editor seeds its state on mount.
  return <SettingsEditor key={data.map((s) => s.key + s.value).join('|')} settings={data} />;
}

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'notifications', label: 'Notifications' },
] as const;

function SettingsEditor({ settings: data }: { settings: Setting[] }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('general');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.map((setting) => [setting.key, setting.value])),
  );

  const save = useMutation({
    mutationFn: () =>
      put('/admin/settings', {
        settings: Object.entries(values).map(([key, value]) => ({ key, value })),
      }),
    onSuccess: () => {
      toast.success('Settings saved');
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings });
    },
  });

  const groups = data.reduce<Record<string, Setting[]>>((acc, setting) => {
    const bucket = acc[setting.group] ?? [];
    bucket.push(setting);
    acc[setting.group] = bucket;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Platform settings"
        description="Defaults that apply across the marketplace. Changes take effect immediately."
        action={
          tab === 'general' ? (
            <Button
              icon={<Save className="h-4 w-4" />}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save changes
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-brand-700 text-white'
                : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(groups).map(([group, settings]) => (
            <Card key={group}>
              <CardHeader
                title={GROUP_TITLES[group]?.title ?? group}
                description={GROUP_TITLES[group]?.description}
              />
              <div className="space-y-4">
                {settings.map((setting) =>
                  setting.dataType === 'boolean' ? (
                    <Checkbox
                      key={setting.key}
                      label={
                        <span>
                          <span className="block text-sm">{setting.label ?? setting.key}</span>
                          <span className="block font-mono text-[11px] text-ink-400">{setting.key}</span>
                        </span>
                      }
                      checked={values[setting.key] === 'true'}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [setting.key]: String(event.target.checked),
                        }))
                      }
                    />
                  ) : (
                    <Input
                      key={setting.key}
                      label={setting.label ?? setting.key}
                      type={setting.dataType === 'number' ? 'number' : 'text'}
                      hint={setting.key}
                      value={values[setting.key] ?? ''}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [setting.key]: event.target.value }))
                      }
                    />
                  ),
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : tab === 'integrations' ? (
        <ProviderCredentialsEditor />
      ) : (
        <NotificationTemplateEditor
          basePath="/admin"
          title="Notification messages"
          description="Platform-wide default wording for each event. A wholesaler or medical shop can override the ones about their own orders."
        />
      )}
    </>
  );
}
