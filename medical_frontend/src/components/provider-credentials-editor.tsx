'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, PlugZap, XCircle } from 'lucide-react';
import { ApiError, getOne, post, put } from '@/lib/api-client';
import { Badge, Button, Card, CardHeader, Input, LoadingBlock, Select } from '@/components/ui';

interface ProviderField {
  key: string;
  label: string;
  secret?: boolean;
  options?: { value: string; label: string }[];
  value: string;
  hasValue: boolean;
}

interface ProviderStatus {
  provider: 'SMS' | 'EMAIL' | 'PAYMENT_GATEWAY';
  isActive: boolean;
  source: 'database' | 'env' | 'none';
  fields: ProviderField[];
}

const PROVIDER_TITLES: Record<ProviderStatus['provider'], string> = {
  SMS: 'SMS / WhatsApp',
  EMAIL: 'Email (SMTP)',
  PAYMENT_GATEWAY: 'Payment gateway',
};

const SOURCE_BADGE: Record<ProviderStatus['source'], { label: string; tone: 'success' | 'info' | 'neutral' }> = {
  database: { label: 'Saved here', tone: 'success' },
  env: { label: 'Using .env', tone: 'info' },
  none: { label: 'Not configured', tone: 'neutral' },
};

/**
 * TASKS.md #16 — masked provider-key editor. Secret fields never round-trip
 * in plain text: the list endpoint returns them pre-masked, and typing a new
 * value is the only way to change one (leaving a secret field blank on save
 * keeps whatever is already stored, since the masked placeholder is never
 * submitted as the real value).
 */
export function ProviderCredentialsEditor() {
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'provider-credentials'] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getOne<ProviderStatus[]>('/admin/settings/providers'),
  });

  if (isLoading || !data) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      {data.map((provider) => (
        <ProviderCard
          key={provider.provider}
          provider={provider}
          onSaved={() => void queryClient.invalidateQueries({ queryKey })}
        />
      ))}
    </div>
  );
}

function ProviderCard({ provider, onSaved }: { provider: ProviderStatus; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(provider.fields.map((field) => [field.key, field.secret ? '' : field.value])),
  );
  const [isActive, setIsActive] = useState(provider.isActive);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = useMutation({
    mutationFn: () => {
      // Blank secret fields mean "keep the existing value" — only send ones the admin actually typed.
      const config: Record<string, string> = {};
      for (const field of provider.fields) {
        const value = values[field.key] ?? '';
        if (!field.secret || value) config[field.key] = value;
      }
      return put(`/admin/settings/providers/${provider.provider}`, { config, isActive });
    },
    onSuccess: () => {
      toast.success('Provider credentials saved');
      setTestResult(null);
      onSaved();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save credentials'),
  });

  const test = useMutation({
    mutationFn: () => post<{ ok: boolean; message: string }>(`/admin/settings/providers/${provider.provider}/test`),
    onSuccess: (result) => setTestResult(result),
    onError: (error) =>
      setTestResult({ ok: false, message: error instanceof ApiError ? error.message : 'Test failed' }),
  });

  const badge = SOURCE_BADGE[provider.source];

  return (
    <Card>
      <CardHeader
        title={PROVIDER_TITLES[provider.provider]}
        description={provider.fields.map((f) => f.label).join(' · ')}
        action={<Badge tone={badge.tone}>{badge.label}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {provider.fields.map((field) =>
          field.options ? (
            <Select
              key={field.key}
              label={field.label}
              value={values[field.key] ?? ''}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              options={[{ value: '', label: 'Select a provider' }, ...field.options]}
            />
          ) : (
            <Input
              key={field.key}
              label={field.label}
              type={field.secret ? 'password' : 'text'}
              placeholder={field.secret && field.hasValue ? field.value : undefined}
              value={values[field.key] ?? ''}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              hint={field.secret && field.hasValue ? 'Leave blank to keep the saved value' : undefined}
            />
          ),
        )}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-ink-300 text-brand-700 accent-brand-700"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        Active — use these credentials instead of .env
      </label>

      {testResult ? (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            testResult.ok ? 'bg-success-soft text-green-800' : 'bg-danger-soft text-red-800'
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
        <Button
          variant="outline"
          icon={<PlugZap className="h-4 w-4" />}
          loading={test.isPending}
          onClick={() => test.mutate()}
        >
          Test connection
        </Button>
      </div>
    </Card>
  );
}
