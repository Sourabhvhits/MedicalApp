'use client';

import { InvoicesPage } from '@/components/invoices-page';

export default function RetailerInvoicesPage() {
  return <InvoicesPage scope="retailer" basePath="/retailer/finance" />;
}
