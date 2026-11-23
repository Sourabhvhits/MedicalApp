'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import { z } from 'zod';
import { toast } from 'sonner';
import { Stethoscope } from 'lucide-react';
import { ApiError, post } from '@/lib/api-client';
import { zodValidate } from '@/lib/zod-formik';
import { Button, Input } from '@/components/ui';

const requestSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or mobile number'),
});

const resetSchema = z
  .object({
    code: z.string().trim().regex(/^\d{4,8}$/, 'Enter the code we sent you'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type RequestValues = z.infer<typeof requestSchema>;
type ResetValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  const requestForm = useFormik<RequestValues>({
    initialValues: { identifier: '' },
    validate: zodValidate(requestSchema),
    onSubmit: async (values) => {
      try {
        const result = await post<{ sent: boolean; devCode?: string }>('/auth/forgot-password', values);
        setIdentifier(values.identifier);
        // The API returns the code outside production so the flow is testable.
        if (result.devCode) setDevCode(result.devCode);
        toast.success('If that account exists, we have sent a reset code.');
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : 'Could not send the code.');
      }
    },
  });

  const resetForm = useFormik<ResetValues>({
    initialValues: { code: '', newPassword: '', confirmPassword: '' },
    validate: zodValidate(resetSchema),
    onSubmit: async (values, { setFieldError, setFieldTouched }) => {
      try {
        await post('/auth/reset-password', {
          identifier,
          code: values.code,
          newPassword: values.newPassword,
        });
        toast.success('Password updated. Please sign in.');
        router.replace('/login');
      } catch (error) {
        if (error instanceof ApiError) {
          setFieldError('code', error.message);
          setFieldTouched('code', true, false);
          return;
        }
        toast.error('Could not reset your password.');
      }
    },
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-white">
          <Stethoscope className="h-5 w-5" />
        </span>
        <span className="text-lg font-semibold text-ink-900">MedMarket</span>
      </Link>

      <h1 className="text-2xl font-semibold text-ink-900">Reset your password</h1>

      {!identifier ? (
        <>
          <p className="mt-1 text-sm text-ink-500">
            Enter the email or mobile number on your account and we will send a verification code.
          </p>
          <form onSubmit={requestForm.handleSubmit} className="mt-8 space-y-4" noValidate>
            <Input
              label="Email or mobile number"
              required
              error={requestForm.touched.identifier ? requestForm.errors.identifier : undefined}
              {...requestForm.getFieldProps('identifier')}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={requestForm.isSubmitting}
            >
              Send reset code
            </Button>
          </form>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-500">
            Enter the code sent to <span className="font-medium text-ink-800">{identifier}</span> and
            choose a new password.
          </p>

          {devCode ? (
            <p className="mt-4 rounded-lg bg-info-soft px-4 py-3 text-sm text-blue-800">
              Development mode — your code is <span className="font-mono font-semibold">{devCode}</span>
            </p>
          ) : null}

          <form onSubmit={resetForm.handleSubmit} className="mt-8 space-y-4" noValidate>
            <Input
              label="Verification code"
              inputMode="numeric"
              required
              error={resetForm.touched.code ? resetForm.errors.code : undefined}
              {...resetForm.getFieldProps('code')}
            />
            <Input
              label="New password"
              type="password"
              required
              error={resetForm.touched.newPassword ? resetForm.errors.newPassword : undefined}
              {...resetForm.getFieldProps('newPassword')}
            />
            <Input
              label="Confirm new password"
              type="password"
              required
              error={resetForm.touched.confirmPassword ? resetForm.errors.confirmPassword : undefined}
              {...resetForm.getFieldProps('confirmPassword')}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={resetForm.isSubmitting}
            >
              Update password
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setIdentifier(null);
                setDevCode(null);
              }}
            >
              Use a different account
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-ink-600">
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
