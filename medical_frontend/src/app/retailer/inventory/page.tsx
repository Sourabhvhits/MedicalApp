'use client';

import { InventoryWorkspace } from '@/components/inventory-workspace';

export default function RetailerInventoryPage() {
  return <InventoryWorkspace scope="retailer" basePath="/retailer/inventory" />;
}
