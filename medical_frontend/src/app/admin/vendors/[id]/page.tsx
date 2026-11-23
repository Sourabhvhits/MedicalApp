'use client';

import { useParams } from 'next/navigation';
import { currency, formatDate } from '@/lib/utils';
import type { Vendor } from '@/lib/types';
import { BusinessDetail } from '@/components/business-detail';

export default function AdminVendorDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <BusinessDetail<Vendor>
      id={params.id}
      kind="vendor"
      backHref="/admin/vendors"
      backLabel="Back to wholesalers"
      present={(vendor) => ({
        title: vendor.businessName,
        subtitle: `${vendor.code} · registered ${formatDate(vendor.createdAt)}`,
        approvalStatus: vendor.approvalStatus,
        rejectionReason: vendor.rejectionReason,
        groups: [
          {
            title: 'Business details',
            fields: [
              { label: 'Contact person', value: vendor.contactPerson },
              { label: 'Phone', value: vendor.phone },
              { label: 'Email', value: vendor.email },
              { label: 'Minimum order value', value: currency(vendor.minOrderValue) },
            ],
          },
          {
            title: 'Compliance',
            fields: [
              { label: 'GSTIN', value: vendor.gstNumber },
              { label: 'Drug licence number', value: vendor.drugLicenseNumber },
              { label: 'Account status', value: vendor.isActive ? 'Active' : 'Inactive' },
              { label: 'Login status', value: vendor.user?.status },
            ],
          },
          {
            title: 'Address',
            fields: [
              { label: 'City', value: vendor.city },
              { label: 'State', value: vendor.state },
              { label: 'Pincode', value: vendor.pincode },
              { label: 'Catalogue size', value: `${vendor._count?.products ?? 0} products` },
            ],
          },
        ],
      })}
    />
  );
}
