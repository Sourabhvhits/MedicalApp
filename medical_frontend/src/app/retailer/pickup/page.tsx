'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Save } from 'lucide-react';
import { ApiError, getOne, patch, put } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn, formatDate, number } from '@/lib/utils';
import type { PickupConfig, SlotCalendarDay } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
} from '@/components/ui';

export default function RetailerPickupPage() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(7);
  // Local edits shadow the saved configuration until they are saved.
  const [draft, setDraft] = useState<Partial<PickupConfig> | null>(null);

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: queryKeys.retailer.pickupConfig,
    queryFn: () => getOne<PickupConfig | null>('/retailer/pickup/config'),
  });

  const { data: calendar, isLoading: loadingCalendar } = useQuery({
    queryKey: queryKeys.retailer.pickupSlots(days),
    queryFn: () => getOne<SlotCalendarDay[]>('/retailer/pickup/slots', { days }),
  });

  const config: PickupConfig = {
    slotDurationMins: 30,
    maxOrdersPerSlot: 10,
    bufferMins: 60,
    advanceDays: 7,
    isEnabled: true,
    ...(savedConfig ?? {}),
    ...(draft ?? {}),
  };

  const saveConfig = useMutation({
    mutationFn: () => put('/retailer/pickup/config', config),
    onSuccess: () => {
      toast.success('Pickup configuration saved');
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.all });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not save the configuration');
    },
  });

  const toggleSlot = useMutation({
    mutationFn: (input: { id: string; status: 'AVAILABLE' | 'DISABLED' }) =>
      patch(`/retailer/pickup/slots/${input.id}`, { status: input.status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retailer.pickupSlots(days) });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the slot');
    },
  });

  if (isLoading) return <LoadingBlock />;

  return (
    <>
      <PageHeader
        title="Pickup slots"
        description="Customers can only choose slots inside your business hours, with enough notice, and with capacity left."
        action={
          <Select
            aria-label="Days ahead"
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
            className="w-40"
            options={[
              { value: '3', label: 'Next 3 days' },
              { value: '7', label: 'Next 7 days' },
              { value: '14', label: 'Next 14 days' },
            ]}
          />
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="Slot configuration"
          description="Changing slot length rebuilds unbooked slots."
          action={
            <Button icon={<Save className="h-4 w-4" />} loading={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
              Save configuration
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label="Slot length (minutes)"
            type="number"
            min={10}
            max={240}
            value={config.slotDurationMins}
            onChange={(event) =>
              setDraft((current) => ({ ...current, slotDurationMins: Number(event.target.value) }))
            }
          />
          <Input
            label="Orders per slot"
            type="number"
            min={1}
            hint="How many pickups you can handle at once"
            value={config.maxOrdersPerSlot}
            onChange={(event) =>
              setDraft((current) => ({ ...current, maxOrdersPerSlot: Number(event.target.value) }))
            }
          />
          <Input
            label="Notice required (minutes)"
            type="number"
            min={0}
            hint="Time you need to prepare an order"
            value={config.bufferMins}
            onChange={(event) =>
              setDraft((current) => ({ ...current, bufferMins: Number(event.target.value) }))
            }
          />
          <Input
            label="Book up to (days ahead)"
            type="number"
            min={1}
            max={30}
            value={config.advanceDays}
            onChange={(event) =>
              setDraft((current) => ({ ...current, advanceDays: Number(event.target.value) }))
            }
          />
          <div className="flex items-end pb-2">
            <Checkbox
              label="Accept pickup bookings"
              checked={config.isEnabled}
              onChange={(event) =>
                setDraft((current) => ({ ...current, isEnabled: event.target.checked }))
              }
            />
          </div>
        </div>
      </Card>

      {loadingCalendar ? (
        <LoadingBlock label="Building the slot calendar…" />
      ) : (
        <div className="space-y-4">
          {calendar?.map((day) => (
            <Card key={day.date}>
              <CardHeader
                title={formatDate(day.date, 'EEEE, dd MMM')}
                description={
                  day.isClosed
                    ? (day.reason ?? 'Closed')
                    : `Open ${day.openTime} – ${day.closeTime} · ${number(day.availableCount)} slot(s) bookable`
                }
                action={
                  day.isClosed ? (
                    <Badge tone="neutral">Closed</Badge>
                  ) : (
                    <Badge tone={day.availableCount > 0 ? 'success' : 'warning'}>
                      {day.availableCount > 0 ? 'Accepting pickups' : 'Fully booked'}
                    </Badge>
                  )
                }
              />

              {day.isClosed ? (
                <p className="flex items-center gap-2 text-sm text-ink-500">
                  <CalendarClock className="h-4 w-4" />
                  No pickup slots are offered on this day.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {day.slots.map((slot) => {
                    const full = slot.bookedCount >= slot.capacity;
                    const disabled = !slot.available && !full;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        title={slot.reason}
                        onClick={() =>
                          toggleSlot.mutate({
                            id: slot.id,
                            status: slot.available ? 'DISABLED' : 'AVAILABLE',
                          })
                        }
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                          full
                            ? 'border-amber-300 bg-warning-soft text-amber-900'
                            : slot.available
                              ? 'border-ink-200 bg-white hover:border-brand-400'
                              : 'border-ink-200 bg-ink-100 text-ink-400',
                        )}
                      >
                        <span className="block font-medium">
                          {slot.startTime} – {slot.endTime}
                        </span>
                        <span className="block">
                          {slot.bookedCount}/{slot.capacity} booked
                        </span>
                        {disabled ? <span className="block text-[11px]">{slot.reason}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-ink-500">
        Click a slot to disable or re-enable it. Slots with bookings cannot be disabled — cancel or
        reschedule those orders first.
      </p>
    </>
  );
}
