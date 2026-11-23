'use client';

import {
  Boxes,
  Building2,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Package,
  Receipt,
  Store,
  Wallet,
} from 'lucide-react';
import { DashboardShell, type NavSection } from '@/components/layout/dashboard-shell';

const ICON = 'h-4 w-4';

const SECTIONS: NavSection[] = [
  {
    items: [{ href: '/vendor', label: 'Dashboard', icon: <LayoutDashboard className={ICON} /> }],
  },
  {
    title: 'Selling',
    items: [
      { href: '/vendor/products', label: 'Catalogue', icon: <Package className={ICON} /> },
      { href: '/vendor/orders', label: 'Retailer orders', icon: <ClipboardList className={ICON} /> },
      { href: '/vendor/retailers', label: 'Retailers', icon: <Store className={ICON} /> },
    ],
  },
  {
    title: 'Stock',
    items: [{ href: '/vendor/inventory', label: 'Inventory', icon: <Boxes className={ICON} /> }],
  },
  {
    title: 'Money',
    items: [
      { href: '/vendor/finance', label: 'Finance', icon: <Wallet className={ICON} /> },
      { href: '/vendor/invoices', label: 'Invoices', icon: <Receipt className={ICON} /> },
      { href: '/vendor/reports', label: 'Reports', icon: <FileBarChart className={ICON} /> },
    ],
  },
  {
    title: 'Business',
    items: [{ href: '/vendor/profile', label: 'Company profile', icon: <Building2 className={ICON} /> }],
  },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell sections={SECTIONS} allow={['VENDOR']} brandLabel="Wholesaler">
      {children}
    </DashboardShell>
  );
}
