'use client';

import { InventoryWorkspace } from '@/components/inventory-workspace';

export default function VendorInventoryPage() {
  return <InventoryWorkspace scope="vendor" basePath="/vendor/inventory" />;
}
