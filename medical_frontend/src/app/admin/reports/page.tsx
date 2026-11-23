'use client';

import {
  LOW_STOCK_REPORT,
  PURCHASE_REPORT,
  ReportsWorkspace,
  SALES_BY_PRODUCT_REPORT,
  SALES_REPORT,
  STOCK_MOVEMENT_REPORT,
  STOCK_REPORT,
  expiryReport,
} from '@/components/reports-workspace';

export default function AdminReportsPage() {
  return (
    <ReportsWorkspace
      title="Platform reports"
      description="Marketplace-wide sales, purchases, stock and expiry — exportable to CSV, Excel or PDF with the filters applied."
      basePath="/admin/reports"
      scope="admin"
      reports={[
        SALES_REPORT,
        SALES_BY_PRODUCT_REPORT,
        PURCHASE_REPORT,
        STOCK_REPORT,
        STOCK_MOVEMENT_REPORT,
        LOW_STOCK_REPORT,
        expiryReport(30, 'Expiring in 30 days'),
        expiryReport(90, 'Expiring in 90 days'),
        expiryReport(0, 'Expired stock'),
      ]}
    />
  );
}
