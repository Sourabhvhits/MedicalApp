'use client';

import {
  AlertTriangle,
  Building2,
  ClipboardList,
  FileBarChart,
  FileCheck2,
  Factory,
  LayoutDashboard,
  Megaphone,
  Package,
  Ruler,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Users,
} from 'lucide-react';
import { DashboardShell, type NavSection } from '@/components/layout/dashboard-shell';
import { GlobalSearch } from '@/components/global-search';

const ICON = 'h-4 w-4';

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className={ICON} />, permission: 'dashboard.view' },
    ],
  },
  {
    title: 'Approvals',
    items: [
      { href: '/admin/vendors', label: 'Wholesalers', icon: <Building2 className={ICON} />, permission: 'vendor.view' },
      { href: '/admin/retailers', label: 'Medical shops', icon: <Store className={ICON} />, permission: 'retailer.view' },
      { href: '/admin/kyc-requirements', label: 'KYC requirements', icon: <FileCheck2 className={ICON} />, permission: 'setting.view' },
    ],
  },
  {
    title: 'Master data',
    items: [
      { href: '/admin/products', label: 'Products', icon: <Package className={ICON} />, permission: 'product.view' },
      { href: '/admin/categories', label: 'Categories', icon: <Tags className={ICON} />, permission: 'category.view' },
      { href: '/admin/manufacturers', label: 'Manufacturers', icon: <Factory className={ICON} />, permission: 'manufacturer.view' },
      { href: '/admin/units', label: 'Units', icon: <Ruler className={ICON} />, permission: 'unit.view' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: <ClipboardList className={ICON} />, permission: 'order.view' },
      { href: '/admin/disputes', label: 'Disputes', icon: <AlertTriangle className={ICON} />, permission: 'dispute.view' },
      { href: '/admin/broadcasts', label: 'Broadcasts', icon: <Megaphone className={ICON} />, permission: 'broadcast.view' },
      { href: '/admin/reports', label: 'Reports', icon: <FileBarChart className={ICON} />, permission: 'report.view' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { href: '/admin/users', label: 'Users', icon: <Users className={ICON} />, permission: 'user.view' },
      { href: '/admin/roles', label: 'Roles & access', icon: <ShieldCheck className={ICON} />, permission: 'role.view' },
      { href: '/admin/settings', label: 'Settings', icon: <Settings className={ICON} />, permission: 'setting.view' },
      { href: '/admin/audit-logs', label: 'Audit log', icon: <ScrollText className={ICON} />, permission: 'audit.view' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      sections={SECTIONS}
      allow={['SUPER_ADMIN', 'ADMIN_STAFF']}
      brandLabel="Platform admin"
      topBarExtra={<GlobalSearch />}
    >
      {children}
    </DashboardShell>
  );
}
