'use client';

import { InvoicesPage } from '@/components/invoices-page';

export default function VendorInvoicesPage() {
  return <InvoicesPage scope="vendor" basePath="/vendor/finance" />;
}
