'use client';

import {
  Boxes,
  CalendarClock,
  FileBarChart,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
} from 'lucide-react';
import { DashboardShell, type NavSection } from '@/components/layout/dashboard-shell';

const ICON = 'h-4 w-4';

const SECTIONS: NavSection[] = [
  {
    items: [{ href: '/retailer', label: 'Dashboard', icon: <LayoutDashboard className={ICON} /> }],
  },
  {
    title: 'Storefront',
    items: [
      { href: '/retailer/pos', label: 'Point of sale', icon: <ShoppingCart className={ICON} /> },
      { href: '/retailer/orders', label: 'Customer orders', icon: <ShoppingBag className={ICON} /> },
      { href: '/retailer/products', label: 'Catalogue', icon: <Package className={ICON} /> },
      { href: '/retailer/pickup', label: 'Pickup slots', icon: <CalendarClock className={ICON} /> },
    ],
  },
  {
    title: 'Supply',
    items: [
      { href: '/retailer/inventory', label: 'Inventory', icon: <Boxes className={ICON} /> },
      { href: '/retailer/purchases', label: 'Purchases', icon: <Truck className={ICON} /> },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/retailer/finance', label: 'Finance', icon: <Wallet className={ICON} /> },
      { href: '/retailer/invoices', label: 'Invoices', icon: <Receipt className={ICON} /> },
      { href: '/retailer/reports', label: 'Reports', icon: <FileBarChart className={ICON} /> },
    ],
  },
  {
    title: 'Business',
    items: [{ href: '/retailer/store', label: 'Store profile', icon: <Store className={ICON} /> }],
  },
];

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell sections={SECTIONS} allow={['RETAILER']} brandLabel="Medical shop">
      {children}
    </DashboardShell>
  );
}
