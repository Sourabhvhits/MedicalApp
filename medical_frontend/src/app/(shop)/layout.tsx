'use client';

import { MarketplaceShell } from '@/components/layout/marketplace-shell';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <MarketplaceShell>{children}</MarketplaceShell>;
}
