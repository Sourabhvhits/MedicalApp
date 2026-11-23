'use client';

import { FinanceWorkspace } from '@/components/finance-workspace';

export default function VendorFinancePage() {
  return <FinanceWorkspace scope="vendor" basePath="/vendor/finance" />;
}
