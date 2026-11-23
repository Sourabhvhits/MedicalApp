'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Minus, Plus, ShoppingCart, Store, Trash2 } from 'lucide-react';
import { ApiError, del, getOne, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { currency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { CartSummary } from '@/lib/types';
import { Badge, Button, Card, EmptyState, LoadingBlock } from '@/components/ui';

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, initialised } = useAuthStore();

  const { data: cart, isLoading } = useQuery({
    queryKey: queryKeys.customer.cart,
    queryFn: () => getOne<CartSummary | null>('/customers/cart'),
    enabled: Boolean(user),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.customer.cart });
  };

  const updateQty = useMutation({
    mutationFn: (input: { id: string; quantity: number }) =>
      put(`/customers/cart/items/${input.id}`, { quantity: input.quantity }),
    onSuccess: invalidate,
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the cart');
    },
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => del(`/customers/cart/items/${id}`),
    onSuccess: () => {
      toast.success('Item removed');
      invalidate();
    },
  });

  const clearCart = useMutation({
    mutationFn: () => del('/customers/cart'),
    onSuccess: () => {
      toast.success('Cart cleared');
      invalidate();
    },
  });

  if (!initialised) return <LoadingBlock />;

  if (!user) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-10 w-10" />}
        title="Sign in to see your cart"
        description="Your cart is tied to your account so you can pick up where you left off."
        action={
          <Link href="/login?next=/cart">
            <Button>Sign in</Button>
          </Link>
        }
      />
    );
  }

  if (isLoading) return <LoadingBlock />;

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-10 w-10" />}
        title="Your cart is empty"
        description="Find a medical store near you and add the medicines you need."
        action={
          <Link href="/stores">
            <Button>Browse nearby stores</Button>
          </Link>
        }
      />
    );
  }

  const blocked = cart.issues.length > 0;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900 sm:text-2xl">Your cart</h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-500">
            <Store className="h-4 w-4" />
            Collecting from{' '}
            <Link
              href={`/stores/${cart.cart?.retailerId}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {cart.cart?.retailer.storeName}
            </Link>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => clearCart.mutate()} loading={clearCart.isPending}>
          Clear cart
        </Button>
      </header>

      {blocked ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-warning-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Fix these before checking out
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-900">
            {cart.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          {cart.items.map((item) => (
            <Card key={item.id} className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h2 className="text-sm font-semibold text-ink-900">{item.name}</h2>
                  {item.prescriptionRequired ? <Badge tone="warning">Rx</Badge> : null}
                </div>
                <p className="mt-0.5 text-xs text-ink-500">{item.packSize}</p>
                <p className="mt-1 text-sm text-ink-700">
                  {currency(item.unitPrice)}
                  {item.unitPrice < item.mrp ? (
                    <span className="ml-2 text-xs text-ink-400 line-through">
                      {currency(item.mrp)}
                    </span>
                  ) : null}
                </p>
                {item.issue ? (
                  <p className="mt-1 text-xs font-medium text-danger">{item.issue}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Decrease quantity"
                  disabled={updateQty.isPending}
                  onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity - 1 })}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-10 text-center text-sm font-medium tabular-nums">
                  {item.quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Increase quantity"
                  disabled={updateQty.isPending || item.quantity >= item.availableQty}
                  onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity + 1 })}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold text-ink-900">{currency(item.lineTotal)}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1"
                  onClick={() => removeItem.mutate(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
            </Card>
          ))}
        </section>

        <aside className="lg:col-span-1">
          <Card className="sticky top-24">
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Order summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Items ({cart.totals.itemCount})</dt>
                <dd className="tabular-nums">{currency(cart.totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Taxable value</dt>
                <dd className="tabular-nums">{currency(cart.totals.taxableAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">CGST + SGST</dt>
                <dd className="tabular-nums">{currency(cart.totals.taxAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold text-ink-900">
                <dt>Total payable</dt>
                <dd className="tabular-nums">{currency(cart.totals.totalAmount)}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-ink-500">
              Prices include GST. Pay at the store when you collect your order.
            </p>

            {cart.requiresPrescription ? (
              <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-amber-900">
                This cart contains prescription-only medicines. You will need to upload a valid
                prescription at checkout and show the original when collecting.
              </p>
            ) : null}

            {cart.interactionWarnings.length > 0 ? (
              <div className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-red-900">
                <p className="font-semibold">Possible interaction</p>
                {cart.interactionWarnings.map((warning) => (
                  <p key={`${warning.compositionA}-${warning.compositionB}`} className="mt-1">
                    {warning.compositionA} + {warning.compositionB}: {warning.description}
                  </p>
                ))}
                <p className="mt-1 text-red-800">
                  This is informational only, not a substitute for professional medical advice.
                </p>
              </div>
            ) : null}

            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={blocked}
              onClick={() => router.push('/checkout')}
            >
              Choose a pickup slot
            </Button>

            <Link href="/stores" className="mt-2 block text-center text-sm text-brand-700 hover:underline">
              Continue shopping
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
