'use client';

import {
  LOW_STOCK_REPORT,
  PURCHASE_REPORT,
  ReportsWorkspace,
  STOCK_MOVEMENT_REPORT,
  STOCK_REPORT,
  expiryReport,
} from '@/components/reports-workspace';

export default function VendorReportsPage() {
  return (
    <ReportsWorkspace
      title="Reports"
      description="Wholesale sales, stock and expiry for your business, exportable with filters applied."
      basePath="/vendor/reports"
      scope="vendor"
      reports={[
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
