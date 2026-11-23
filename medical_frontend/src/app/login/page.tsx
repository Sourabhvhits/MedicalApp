'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormik } from 'formik';
import { z } from 'zod';
import { toast } from 'sonner';
import { Stethoscope } from 'lucide-react';
import { ApiError, post } from '@/lib/api-client';
import { HOME_ROUTE, useAuthStore } from '@/store/auth-store';
import { zodValidate } from '@/lib/zod-formik';
import type { AuthProfile, AuthTokens } from '@/lib/types';
import { Button, Card, Input, LoadingBlock } from '@/components/ui';

const schema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or mobile number'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Super admin', identifier: 'admin@medsaas.test', password: 'Admin@12345' },
  { label: 'Wholesaler', identifier: 'vendor1@medsaas.test', password: 'Demo@12345' },
  { label: 'Medical shop', identifier: 'shop1@medsaas.test', password: 'Demo@12345' },
  { label: 'Customer', identifier: 'customer1@medsaas.test', password: 'Demo@12345' },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, initialised, setSession } = useAuthStore();
  const next = params.get('next');

  const formik = useFormik<FormValues>({
    initialValues: { identifier: '', password: '' },
    validate: zodValidate(schema),
    onSubmit: async (values, { setFieldError, setFieldTouched }) => {
      try {
        const result = await post<{ user: AuthProfile; tokens: AuthTokens }>('/auth/login', values);
        setSession(result);
        toast.success(`Welcome back, ${result.user.firstName}`);
        router.replace(next ?? HOME_ROUTE[result.user.userType]);
      } catch (error) {
        if (error instanceof ApiError) {
          const fields = error.fieldErrors;
          const target = Object.keys(fields).length > 0 ? fields : { password: error.message };
          Object.entries(target).forEach(([field, message]) => {
            setFieldError(field, message);
            setFieldTouched(field, true, false);
          });
          return;
        }
        toast.error('Could not sign you in. Please try again.');
      }
    },
  });

  useEffect(() => {
    if (initialised && user) router.replace(next ?? HOME_ROUTE[user.userType]);
  }, [initialised, user, router, next]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-white">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold text-ink-900">MedMarket</span>
          </Link>

          <h1 className="text-2xl font-semibold text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">
            Use the email or mobile number registered with your account.
          </p>

          <form onSubmit={formik.handleSubmit} className="mt-8 space-y-4" noValidate>
            <Input
              label="Email or mobile number"
              placeholder="you@example.com"
              autoComplete="username"
              required
              error={formik.touched.identifier ? formik.errors.identifier : undefined}
              {...formik.getFieldProps('identifier')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              error={formik.touched.password ? formik.errors.password : undefined}
              {...formik.getFieldProps('password')}
            />

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" size="lg" className="w-full" loading={formik.isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-600">
            New here?{' '}
            <Link href="/register" className="font-medium text-brand-700 hover:underline">
              Create an account
            </Link>
          </p>

          <Card className="mt-8 bg-ink-50" padded>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Demo accounts
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.identifier}
                  type="button"
                  onClick={() => {
                    void formik.setFieldValue('identifier', account.identifier);
                    void formik.setFieldValue('password', account.password);
                  }}
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-brand-300"
                >
                  <span className="block font-medium text-ink-800">{account.label}</span>
                  <span className="block truncate text-ink-500">{account.identifier}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <aside className="hidden bg-brand-800 lg:flex lg:flex-col lg:justify-center lg:px-12">
        <blockquote className="max-w-md">
          <p className="text-2xl font-medium leading-snug text-white">
            Every strip has a batch, an expiry and a paper trail. This platform treats that as the
            starting point, not an afterthought.
          </p>
          <footer className="mt-6 text-sm text-brand-200">
            Batch-wise stock · FEFO consumption · expiry alerts · GST invoicing · full audit log
          </footer>
        </blockquote>
      </aside>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <LoginForm />
    </Suspense>
  );
}
