'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormik } from 'formik';
import { toast } from 'sonner';
import { Heart, LogOut, MapPin, Plus, Store, Trash2, User } from 'lucide-react';
import { ApiError, del, getOne, post, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth-store';
import type { CustomerAddressRecord } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
} from '@/components/ui';

interface CustomerProfile {
  id: string;
  code: string;
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    emailVerifiedAt: string | null;
    phoneVerifiedAt: string | null;
  };
  addresses: CustomerAddressRecord[];
}

interface Favorites {
  stores: { favoriteId: string; id: string; storeName: string; city: string | null; ratingAvg: number }[];
  products: { favoriteId: string; id: string; name: string; brandName: string | null; packSize: string | null }[];
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  email: string;
}

interface AddressForm {
  label: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const EMPTY_ADDRESS: AddressForm = {
  label: 'Home',
  contactName: '',
  contactPhone: '',
  addressLine1: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
};

export default function CustomerProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, initialised, logout } = useAuthStore();
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [deleting, setDeleting] = useState<CustomerAddressRecord | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.customer.profile,
    queryFn: () => getOne<CustomerProfile>('/customers/profile'),
    enabled: Boolean(user),
  });

  const { data: favorites } = useQuery({
    queryKey: queryKeys.customer.favorites,
    queryFn: () => getOne<Favorites>('/customers/favorites'),
    enabled: Boolean(user),
  });

  // `enableReinitialize` re-seeds values once the async `profile` query resolves,
  // instead of an effect calling `resetForm` after the fact.
  const form = useFormik<ProfileForm>({
    initialValues: {
      firstName: profile?.user.firstName ?? '',
      lastName: profile?.user.lastName ?? '',
      email: profile?.user.email ?? '',
    },
    enableReinitialize: true,
    onSubmit: (values) => saveProfile.mutate(values),
  });

  const saveProfile = useMutation({
    mutationFn: (values: ProfileForm) =>
      put('/customers/profile', {
        firstName: values.firstName,
        lastName: values.lastName || undefined,
        email: values.email || undefined,
      }),
    onSuccess: () => {
      toast.success('Profile updated');
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.profile });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors).forEach(([field, message]) => {
          form.setFieldError(field, message);
          form.setFieldTouched(field, true, false);
        });
        if (Object.keys(error.fieldErrors).length === 0) toast.error(error.message);
      }
    },
  });

  const saveAddress = useMutation({
    mutationFn: () =>
      post('/customers/addresses', {
        ...addressForm,
        label: addressForm.label || undefined,
        contactName: addressForm.contactName || undefined,
        contactPhone: addressForm.contactPhone || undefined,
        landmark: addressForm.landmark || undefined,
        city: addressForm.city || undefined,
        state: addressForm.state || undefined,
        pincode: addressForm.pincode || undefined,
      }),
    onSuccess: () => {
      toast.success('Address saved');
      setAddressOpen(false);
      setAddressForm(EMPTY_ADDRESS);
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.profile });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the address');
    },
  });

  const removeAddress = useMutation({
    mutationFn: (id: string) => del(`/customers/addresses/${id}`),
    onSuccess: () => {
      toast.success('Address removed');
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.profile });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: (input: { retailerId?: string; productId?: string }) =>
      post('/customers/favorites', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customer.favorites });
    },
  });

  if (!initialised) return <LoadingBlock />;

  if (!user) {
    return (
      <EmptyState
        icon={<User className="h-10 w-10" />}
        title="Sign in to view your profile"
        action={
          <Link href="/login?next=/profile">
            <Button>Sign in</Button>
          </Link>
        }
      />
    );
  }

  if (isLoading || !profile) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Your profile"
        description={`Customer ${profile.code}`}
        action={
          <Button
            variant="outline"
            icon={<LogOut className="h-4 w-4" />}
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Sign out
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal details" />
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit}>
            <Input
              label="First name"
              required
              error={form.touched.firstName ? form.errors.firstName : undefined}
              {...form.getFieldProps('firstName')}
            />
            <Input label="Last name" {...form.getFieldProps('lastName')} />
            <Input
              label="Email"
              type="email"
              className="sm:col-span-2"
              hint={
                profile.user.emailVerifiedAt
                  ? 'Verified'
                  : 'Changing your email will require verification again'
              }
              error={form.touched.email ? form.errors.email : undefined}
              {...form.getFieldProps('email')}
            />
            <div className="sm:col-span-2">
              <p className="mb-3 text-sm text-ink-600">
                Mobile number: <span className="font-medium text-ink-900">{profile.user.phone}</span>{' '}
                {profile.user.phoneVerifiedAt ? <Badge tone="success">Verified</Badge> : null}
              </p>
              <Button type="submit" loading={saveProfile.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Saved addresses"
            description="Used to prefill your details and find stores near you."
            action={
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAddressOpen(true)}>
                Add
              </Button>
            }
          />
          {profile.addresses.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No addresses saved yet.</p>
          ) : (
            <ul className="space-y-3">
              {profile.addresses.map((address) => (
                <li key={address.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                        {address.label ?? 'Address'}
                        {address.isDefault ? <Badge tone="brand">Default</Badge> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-600">
                        {[address.addressLine1, address.landmark, address.city, address.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {address.contactPhone ? (
                        <p className="text-xs text-ink-500">{address.contactPhone}</p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove address"
                      onClick={() => setDeleting(address)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Favourite stores" />
          {!favorites || favorites.stores.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">
              Tap the heart on a store to save it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {favorites.stores.map((store) => (
                <li key={store.favoriteId} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/stores/${store.id}`}
                    className="inline-flex min-w-0 items-center gap-2 text-sm text-ink-800 hover:text-brand-700"
                  >
                    <Store className="h-4 w-4 shrink-0 text-ink-400" />
                    <span className="truncate">{store.storeName}</span>
                    <span className="shrink-0 text-xs text-ink-500">{store.city}</span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove favourite"
                    onClick={() => toggleFavorite.mutate({ retailerId: store.id })}
                  >
                    <Heart className="h-4 w-4 fill-danger text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Favourite products" />
          {!favorites || favorites.products.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">
              Save products you buy regularly for quicker reordering.
            </p>
          ) : (
            <ul className="space-y-2">
              {favorites.products.map((product) => (
                <li key={product.favoriteId} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink-800">{product.name}</span>
                    <span className="block text-xs text-ink-500">
                      {[product.brandName, product.packSize].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove favourite"
                    onClick={() => toggleFavorite.mutate({ productId: product.id })}
                  >
                    <Heart className="h-4 w-4 fill-danger text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        title="Add an address"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddressOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saveAddress.isPending}
              onClick={() => {
                if (addressForm.addressLine1.trim().length < 3) {
                  toast.error('Enter the address');
                  return;
                }
                saveAddress.mutate();
              }}
            >
              Save address
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Label"
            placeholder="Home, Work…"
            value={addressForm.label}
            onChange={(event) =>
              setAddressForm((current) => ({ ...current, label: event.target.value }))
            }
          />
          <Input
            label="Contact phone"
            value={addressForm.contactPhone}
            onChange={(event) =>
              setAddressForm((current) => ({ ...current, contactPhone: event.target.value }))
            }
          />
          <Input
            label="Address"
            required
            className="sm:col-span-2"
            value={addressForm.addressLine1}
            onChange={(event) =>
              setAddressForm((current) => ({ ...current, addressLine1: event.target.value }))
            }
          />
          <Input
            label="Landmark"
            value={addressForm.landmark}
            onChange={(event) =>
              setAddressForm((current) => ({ ...current, landmark: event.target.value }))
            }
          />
          <Input
            label="City"
            value={addressForm.city}
            onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))}
          />
          <Input
            label="State"
            value={addressForm.state}
            onChange={(event) => setAddressForm((current) => ({ ...current, state: event.target.value }))}
          />
          <Input
            label="Pincode"
            inputMode="numeric"
            value={addressForm.pincode}
            onChange={(event) =>
              setAddressForm((current) => ({ ...current, pincode: event.target.value }))
            }
          />
          <div className="sm:col-span-2">
            <Checkbox
              label="Make this my default address"
              checked={addressForm.isDefault}
              onChange={(event) =>
                setAddressForm((current) => ({ ...current, isDefault: event.target.checked }))
              }
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeAddress.mutate(deleting.id)}
        title="Remove address"
        message="This address will be deleted from your profile."
        confirmLabel="Remove"
        loading={removeAddress.isPending}
      />

      <p className="mt-6 flex items-center gap-1.5 text-xs text-ink-500">
        <MapPin className="h-3.5 w-3.5" />
        Your search location is stored on this device only and can be changed from the header.
      </p>
    </>
  );
}
