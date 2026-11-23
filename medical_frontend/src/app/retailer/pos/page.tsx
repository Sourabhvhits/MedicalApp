'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { ApiError, getOne, post } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useDebouncedValue } from '@/hooks/use-list';
import { currency } from '@/lib/utils';
import type { Sale } from '@/lib/types';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui';
import { BarcodeScanButton } from '@/components/barcode-scanner';

interface PosProduct {
  id: string;
  productId: string;
  sellingPrice: string;
  gstRate: string;
  discountPct: string;
  product: { id: string; name: string; sku: string; packSize: string | null; imageUrl: string | null };
}

interface CartLine {
  productId: string;
  name: string;
  sku: string;
  packSize: string | null;
  sellingPrice: number;
  gstRate: number;
  discountPct: number;
  quantity: number;
}

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'NET_BANKING', label: 'Net banking' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
];

function lineTotal(line: Pick<CartLine, 'sellingPrice' | 'quantity' | 'discountPct'>) {
  return line.sellingPrice * line.quantity * (1 - line.discountPct / 100);
}

export default function RetailerPosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const { data: results, isLoading: searching } = useQuery({
    queryKey: queryKeys.retailer.posProducts(debouncedSearch),
    queryFn: () => getOne<PosProduct[]>('/retailer/pos/products', { search: debouncedSearch }),
  });

  const total = useMemo(() => cart.reduce((sum, line) => sum + lineTotal(line), 0), [cart]);

  const addToCart = (item: PosProduct) => {
    setCart((current) => {
      const existing = current.find((line) => line.productId === item.productId);
      if (existing) {
        return current.map((line) =>
          line.productId === item.productId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          packSize: item.product.packSize,
          sellingPrice: Number(item.sellingPrice),
          gstRate: Number(item.gstRate),
          discountPct: Number(item.discountPct),
          quantity: 1,
        },
      ];
    });
  };

  const changeQty = (productId: string, quantity: number) => {
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity: Math.max(1, quantity) } : line)),
    );
  };

  const removeLine = (productId: string) => {
    setCart((current) => current.filter((line) => line.productId !== productId));
  };

  const resetSale = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMode('CASH');
  };

  const completeSale = useMutation({
    mutationFn: () =>
      post<Sale>('/retailer/pos/sales', {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMode,
        items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      }),
    onSuccess: (sale) => {
      toast.success(`Sale ${sale.saleNumber} recorded`);
      setReceipt(sale);
      resetSale();
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not record the sale');
    },
  });

  return (
    <>
      <PageHeader
        title="Point of sale"
        description="Ring up a walk-in counter sale — no customer account or pickup slot needed."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Search products"
                  placeholder="Search by name or SKU"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <BarcodeScanButton onDetect={(code) => setSearch(code)} />
            </div>

            <div className="mt-4">
              {searching ? (
                <LoadingBlock />
              ) : !results || results.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-8 w-8" />}
                  title="No products found"
                  description="Try a different search, or add products to your catalogue first."
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {results.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">{item.product.name}</p>
                        <p className="text-xs text-ink-500">
                          {[item.product.sku, item.product.packSize].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-ink-900">
                        {currency(item.sellingPrice)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => addToCart(item)}
                      >
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader title="Current sale" description={`${cart.length} item(s)`} />

            {cart.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="h-8 w-8" />}
                title="Cart is empty"
                description="Add products from the search results to start a sale."
              />
            ) : (
              <ul className="mb-4 space-y-3">
                {cart.map((line) => (
                  <li key={line.productId} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{line.name}</p>
                      <p className="text-xs text-ink-500">{currency(line.sellingPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Decrease"
                        onClick={() => changeQty(line.productId, line.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <input
                        type="number"
                        value={line.quantity}
                        min={1}
                        onChange={(event) => changeQty(line.productId, Number(event.target.value))}
                        className="w-12 rounded-lg border border-ink-300 px-1 py-1.5 text-center text-sm tabular-nums"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Increase"
                        onClick={() => changeQty(line.productId, line.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <span className="w-20 text-right text-sm font-medium tabular-nums text-ink-900">
                      {currency(lineTotal(line))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove"
                      onClick={() => removeLine(line.productId)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3 border-t border-ink-200 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Customer name"
                  placeholder="Walk-in customer"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
                <Input
                  label="Phone"
                  placeholder="Optional"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </div>
              <Select
                label="Payment mode"
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
                options={PAYMENT_MODES}
              />

              <div className="flex items-center justify-between border-t border-ink-200 pt-3">
                <span className="text-sm text-ink-500">Total (incl. GST)</span>
                <span className="text-lg font-semibold tabular-nums text-ink-900">{currency(total)}</span>
              </div>

              <Button
                className="w-full"
                disabled={cart.length === 0}
                loading={completeSale.isPending}
                onClick={() => completeSale.mutate()}
              >
                Complete sale
              </Button>
              {cart.length > 0 ? (
                <Button variant="ghost" size="sm" className="w-full" onClick={resetSale}>
                  Clear cart
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title={receipt?.saleNumber ?? 'Receipt'}
        description={receipt ? `${receipt.customerName ?? 'Walk-in customer'} · ${receipt.paymentMode}` : undefined}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              icon={<Printer className="h-4 w-4" />}
              onClick={() => window.print()}
              className="no-print"
            >
              Print
            </Button>
            <Button onClick={() => setReceipt(null)}>New sale</Button>
          </>
        }
      >
        {receipt ? (
          <div className="space-y-3 text-sm">
            <ul className="divide-y divide-ink-100">
              {receipt.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium text-ink-900">{item.productName}</p>
                    <p className="text-xs text-ink-500">
                      {item.quantity} × {currency(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums text-ink-900">{currency(item.totalAmount)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-ink-200 pt-2">
              <div className="flex justify-between text-ink-500">
                <dt>Taxable</dt>
                <dd className="tabular-nums">{currency(receipt.taxableAmount)}</dd>
              </div>
              <div className="flex justify-between text-ink-500">
                <dt>GST</dt>
                <dd className="tabular-nums">{currency(receipt.taxAmount)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold text-ink-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{currency(receipt.totalAmount)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
