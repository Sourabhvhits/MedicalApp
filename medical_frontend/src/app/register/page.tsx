'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormik } from 'formik';
import { z } from 'zod';
import { toast } from 'sonner';
import { ShoppingBag, Stethoscope, Truck } from 'lucide-react';
import { ApiError, post } from '@/lib/api-client';
import { HOME_ROUTE, useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { zodValidate } from '@/lib/zod-formik';
import type { AuthProfile, AuthTokens } from '@/lib/types';
import { Button, Input, LoadingBlock } from '@/components/ui';

const ACCOUNT_TYPES = [
  {
    value: 'CUSTOMER',
    label: 'Customer',
    description: 'Buy medicines from nearby stores and collect them yourself.',
    icon: <ShoppingBag className="h-5 w-5" />,
  },
  {
    value: 'RETAILER',
    label: 'Medical shop',
    description: 'Sell to customers, manage stock, batches and purchases.',
    icon: <Stethoscope className="h-5 w-5" />,
  },
  {
    value: 'VENDOR',
    label: 'Wholesaler',
    description: 'Supply medical shops with wholesale stock.',
    icon: <Truck className="h-5 w-5" />,
  },
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number]['value'];

const schema = z
  .object({
    userType: z.enum(['CUSTOMER', 'RETAILER', 'VENDOR']),
    firstName: z.string().trim().min(2, 'Enter your first name').max(100),
    lastName: z.string().trim().max(100).optional(),
    businessName: z.string().trim().max(191).optional(),
    email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    }
    if (data.userType !== 'CUSTOMER') {
      if (!data.businessName || data.businessName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['businessName'],
          message: 'Enter your registered business name',
        });
      }
      if (!data.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: 'Business accounts need an email address',
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, initialised, setSession } = useAuthStore();

  const initialType = (params.get('type') as AccountType) ?? 'CUSTOMER';
  const startingType = ACCOUNT_TYPES.some((type) => type.value === initialType)
    ? initialType
    : 'CUSTOMER';

  const formik = useFormik<FormValues>({
    initialValues: {
      userType: startingType,
      firstName: '',
      lastName: '',
      businessName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
    validate: zodValidate(schema),
    onSubmit: async (values, { setFieldError, setFieldTouched }) => {
      const isBusinessSubmit = values.userType !== 'CUSTOMER';
      try {
        const payload = {
          userType: values.userType,
          firstName: values.firstName,
          lastName: values.lastName || undefined,
          phone: values.phone,
          password: values.password,
          email: values.email || undefined,
          businessName: isBusinessSubmit ? values.businessName : undefined,
        };

        const result = await post<{ user: AuthProfile; tokens: AuthTokens }>('/auth/register', payload);
        setSession(result);

        toast.success(
          isBusinessSubmit
            ? 'Account created. Complete your profile — an admin will review it for approval.'
            : 'Welcome to MedMarket!',
        );
        router.replace(HOME_ROUTE[result.user.userType]);
      } catch (error) {
        if (error instanceof ApiError) {
          const fields = error.fieldErrors;
          if (Object.keys(fields).length > 0) {
            Object.entries(fields).forEach(([field, message]) => {
              setFieldError(field, message);
              setFieldTouched(field, true, false);
            });
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.error('Could not create your account. Please try again.');
      }
    },
  });

  const accountType = formik.values.userType;
  const isBusiness = accountType !== 'CUSTOMER';

  useEffect(() => {
    if (initialised && user) router.replace(HOME_ROUTE[user.userType]);
  }, [initialised, user, router]);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-white">
          <Stethoscope className="h-5 w-5" />
        </span>
        <span className="text-lg font-semibold text-ink-900">MedMarket</span>
      </Link>

      <h1 className="text-2xl font-semibold text-ink-900">Create your account</h1>
      <p className="mt-1 text-sm text-ink-500">
        Choose the account type that matches how you will use the platform.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {ACCOUNT_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => void formik.setFieldValue('userType', type.value)}
            aria-pressed={accountType === type.value}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              accountType === type.value
                ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                : 'border-ink-200 bg-white hover:border-ink-300',
            )}
          >
            <span
              className={cn(
                'grid h-9 w-9 place-items-center rounded-lg',
                accountType === type.value ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600',
              )}
            >
              {type.icon}
            </span>
            <span className="mt-3 block text-sm font-semibold text-ink-900">{type.label}</span>
            <span className="mt-1 block text-xs text-ink-500">{type.description}</span>
          </button>
        ))}
      </div>

      <form onSubmit={formik.handleSubmit} className="mt-8 space-y-4" noValidate>
        {isBusiness ? (
          <Input
            label={accountType === 'VENDOR' ? 'Business name' : 'Store name'}
            placeholder={accountType === 'VENDOR' ? 'MediSupply Wholesale Pvt Ltd' : 'Apollo Medical Store'}
            required
            error={formik.touched.businessName ? formik.errors.businessName : undefined}
            {...formik.getFieldProps('businessName')}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            required
            autoComplete="given-name"
            error={formik.touched.firstName ? formik.errors.firstName : undefined}
            {...formik.getFieldProps('firstName')}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            error={formik.touched.lastName ? formik.errors.lastName : undefined}
            {...formik.getFieldProps('lastName')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Mobile number"
            placeholder="9876543210"
            inputMode="numeric"
            required
            autoComplete="tel"
            hint="We send order updates and OTPs here"
            error={formik.touched.phone ? formik.errors.phone : undefined}
            {...formik.getFieldProps('phone')}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            required={isBusiness}
            autoComplete="email"
            error={formik.touched.email ? formik.errors.email : undefined}
            {...formik.getFieldProps('email')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            hint="8+ characters with upper, lower and a number"
            error={formik.touched.password ? formik.errors.password : undefined}
            {...formik.getFieldProps('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            error={formik.touched.confirmPassword ? formik.errors.confirmPassword : undefined}
            {...formik.getFieldProps('confirmPassword')}
          />
        </div>

        {isBusiness ? (
          <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-amber-800">
            After registering you will be asked for your drug licence, GST and address details. A
            platform admin reviews them before your account can trade.
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" loading={formik.isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-600">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RegisterForm />
    </Suspense>
  );
}
