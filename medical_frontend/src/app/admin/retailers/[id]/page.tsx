'use client';

import { useParams } from 'next/navigation';
import { DAY_NAMES, formatDate } from '@/lib/utils';
import type { Retailer } from '@/lib/types';
import { BusinessDetail } from '@/components/business-detail';
import { Card, CardHeader } from '@/components/ui';

export default function AdminRetailerDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <BusinessDetail<Retailer>
      id={params.id}
      kind="retailer"
      backHref="/admin/retailers"
      backLabel="Back to medical shops"
      present={(retailer) => ({
        title: retailer.storeName,
        subtitle: `${retailer.code} · registered ${formatDate(retailer.createdAt)}`,
        approvalStatus: retailer.approvalStatus,
        rejectionReason: retailer.rejectionReason,
        groups: [
          {
            title: 'Store details',
            fields: [
              { label: 'Owner', value: retailer.ownerName },
              { label: 'Phone', value: retailer.phone },
              { label: 'Email', value: retailer.email },
              {
                label: 'Trading status',
                value: retailer.isTemporarilyClosed ? 'Temporarily closed' : 'Open for orders',
              },
            ],
          },
          {
            title: 'Compliance',
            fields: [
              { label: 'GSTIN', value: retailer.gstNumber },
              { label: 'Drug licence number', value: retailer.drugLicenseNumber },
              { label: 'Products listed', value: retailer._count?.products ?? 0 },
              { label: 'Orders received', value: retailer._count?.orders ?? 0 },
            ],
          },
          {
            title: 'Location',
            fields: [
              { label: 'Address', value: retailer.addressLine1 },
              { label: 'City / state', value: [retailer.city, retailer.state].filter(Boolean).join(', ') },
              { label: 'Pincode', value: retailer.pincode },
              {
                label: 'Map coordinates',
                value:
                  retailer.latitude && retailer.longitude
                    ? `${Number(retailer.latitude).toFixed(5)}, ${Number(retailer.longitude).toFixed(5)}`
                    : 'Not set — the store will not appear in nearby search',
              },
            ],
          },
        ],
        extra: retailer.businessHours?.length ? (
          <Card>
            <CardHeader title="Business hours" description="Drives pickup slot availability." />
            <ul className="divide-y divide-ink-100 text-sm">
              {retailer.businessHours.map((hour) => (
                <li key={hour.dayOfWeek} className="flex items-center justify-between py-2">
                  <span className="text-ink-700">{DAY_NAMES[hour.dayOfWeek]}</span>
                  <span className={hour.isClosed ? 'text-ink-400' : 'font-medium text-ink-800'}>
                    {hour.isClosed ? 'Closed' : `${hour.openTime} – ${hour.closeTime}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : undefined,
      })}
    />
  );
}
