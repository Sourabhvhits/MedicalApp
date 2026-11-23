import React from 'react';
import { View, Text } from 'react-native';
import { OrderStepperProps } from './orderStepperProps';
import { styles } from './orderStepper.style';

const TERMINAL_STATUSES = ['CANCELLED', 'REJECTED', 'EXPIRED'];

interface StepDef {
  key: string;
  label: string;
  matchingStatuses: string[];
}

export const OrderStepper: React.FC<OrderStepperProps> = ({
  currentStatus,
  fulfillmentType = 'PICKUP',
  history = [],
}) => {
  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);

  const steps: StepDef[] = [
    { key: 'placed', label: 'Order Placed', matchingStatuses: ['PENDING'] },
    { key: 'accepted', label: 'Store Confirmed', matchingStatuses: ['ACCEPTED'] },
    { key: 'preparing', label: 'Preparing Medicines', matchingStatuses: ['PREPARING'] },
    {
      key: 'ready',
      label: fulfillmentType === 'PICKUP' ? 'Ready for Pickup' : 'Out for Delivery',
      matchingStatuses: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'],
    },
    {
      key: 'completed',
      label: fulfillmentType === 'PICKUP' ? 'Picked Up' : 'Delivered',
      matchingStatuses: ['PICKED_UP', 'DELIVERED', 'COMPLETED'],
    },
  ];

  // Determine current active step index in standard flow
  let activeIndex = -1;
  steps.forEach((step, idx) => {
    if (step.matchingStatuses.includes(currentStatus)) {
      activeIndex = idx;
    }
  });

  // If status is completed, all steps are done
  if (['PICKED_UP', 'DELIVERED', 'COMPLETED'].includes(currentStatus)) {
    activeIndex = steps.length - 1;
  }

  // Find history note/date for a given status
  const findHistoryItem = (statuses: string[]) => {
    return history.find((h) => statuses.includes(h.status));
  };

  const terminalHistory = isTerminal
    ? history.find((h) => TERMINAL_STATUSES.includes(h.status))
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Status</Text>

      {isTerminal ? (
        <View style={styles.terminalAlert}>
          <Text style={styles.terminalTitle}>
            {currentStatus === 'CANCELLED'
              ? 'Order Cancelled'
              : currentStatus === 'REJECTED'
              ? 'Order Rejected by Pharmacy'
              : 'Order Expired'}
          </Text>
          {terminalHistory?.note ? (
            <Text style={styles.terminalNote}>Reason: {terminalHistory.note}</Text>
          ) : null}
        </View>
      ) : null}

      {steps.map((step, idx) => {
        const isDone = !isTerminal && activeIndex > idx;
        const isActive = !isTerminal && activeIndex === idx;
        const isLast = idx === steps.length - 1;
        const histItem = findHistoryItem(step.matchingStatuses);

        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.indicatorCol}>
              <View
                style={[
                  styles.circle,
                  isDone && styles.circleDone,
                  isActive && styles.circleActive,
                ]}
              >
                {(isDone || isActive) && <View style={styles.circleDot} />}
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.verticalLine,
                    isDone && styles.verticalLineDone,
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.contentCol}>
              <Text
                style={[
                  styles.stepLabel,
                  (isActive || isDone) && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
              {histItem?.createdAt ? (
                <Text style={styles.stepTime}>
                  {new Date(histItem.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              ) : null}
              {histItem?.note ? (
                <Text style={styles.stepNote}>{histItem.note}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default OrderStepper;
