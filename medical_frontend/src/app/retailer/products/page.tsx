'use client';

import { queryKeys } from '@/lib/query-keys';
import { CatalogManager } from '@/components/catalog-manager';

export default function RetailerCatalogPage() {
  return (
    <CatalogManager
      variant="retailer"
      endpoint="/retailer/products"
      queryKeyFactory={queryKeys.retailer.catalog}
    />
  );
}
