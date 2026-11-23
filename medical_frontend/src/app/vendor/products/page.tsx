'use client';

import { queryKeys } from '@/lib/query-keys';
import { CatalogManager } from '@/components/catalog-manager';

export default function VendorCatalogPage() {
  return (
    <CatalogManager
      variant="vendor"
      endpoint="/vendor/products"
      queryKeyFactory={queryKeys.vendor.catalog}
    />
  );
}
