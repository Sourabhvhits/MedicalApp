import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './checkout.style';
import useCheckout from './useCheckout';
import { Header, Button, Input } from '../../../components/componentsIndex';
import { UploadIcon } from '../../../assets/svg/UploadIcon';
import { CheckIcon } from '../../../assets/svg/CheckIcon';
import { formatCurrency } from '../../../utility/common';

export const Checkout: React.FC = () => {
  const {
    storeName,
    totals,
    prescriptionRequired,
    prescriptionUrl,
    pickupSlots,
    selectedSlotId,
    paymentMode,
    notes,
    loading,
    uploadingRx,
    setSelectedSlotId,
    setPaymentMode,
    setNotes,
    handleUploadPrescription,
    handlePlaceOrder,
    goBack,
  } = useCheckout();

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Checkout" showBack onBackPress={goBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Prescription Verification Gate */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Doctor's Prescription</Text>

          {prescriptionRequired && (
            <View style={styles.rxRequiredNotice}>
              <Text style={styles.rxRequiredText}>
                ⚠️ Prescription is mandatory for this order due to Schedule medicine or clinical drug-interaction safety requirements.
              </Text>
            </View>
          )}

          {prescriptionUrl ? (
            <View style={styles.uploadedBadge}>
              <CheckIcon width={18} height={18} />
              <Text style={styles.uploadedText}>
                Prescription attached (Pharmacist will verify)
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadBox}
              onPress={handleUploadPrescription}
              disabled={uploadingRx}
              activeOpacity={0.8}
            >
              <UploadIcon width={28} height={28} />
              <Text style={styles.uploadTitle}>
                {uploadingRx ? 'Attaching...' : 'Upload Prescription (Camera / File)'}
              </Text>
              <Text style={styles.uploadSubtitle}>
                Supports JPG, PNG or PDF up to 5MB
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pickup Slot Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickup Time at {storeName || 'Pharmacy'}</Text>
          {pickupSlots.length > 0 ? (
            <View style={styles.slotPillsRow}>
              {pickupSlots.slice(0, 6).map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[styles.slotPill, isSelected && styles.slotPillActive]}
                    onPress={() => setSelectedSlotId(slot.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.slotText, isSelected && styles.slotTextActive]}>
                      {slot.startTime} - {slot.endTime}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.summaryLabel}>
              Standard In-Store Collection (Ready within 15–30 minutes)
            </Text>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Method</Text>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMode === 'CASH' && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMode('CASH')}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.radioCircle,
                paymentMode === 'CASH' && styles.radioCircleActive,
              ]}
            >
              {paymentMode === 'CASH' && <View style={styles.radioDot} />}
            </View>
            <View>
              <Text style={styles.paymentLabel}>Pay at Pharmacy (Cash / UPI / Card)</Text>
              <Text style={styles.paymentDesc}>Pay upon physical collection of your order</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMode === 'ONLINE' && styles.paymentOptionActive,
            ]}
            onPress={() => setPaymentMode('ONLINE')}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.radioCircle,
                paymentMode === 'ONLINE' && styles.radioCircleActive,
              ]}
            >
              {paymentMode === 'ONLINE' && <View style={styles.radioDot} />}
            </View>
            <View>
              <Text style={styles.paymentLabel}>Pay Online</Text>
              <Text style={styles.paymentDesc}>UPI, Net Banking, Credit/Debit Card</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Notes for Pharmacist */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Instructions for Pharmacist</Text>
          <Input
            placeholder="e.g. Please pack separate blister strips"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Order Bill Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxes & GST</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.taxTotal)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalValue}>{formatCurrency(totals.total)}</Text>
          </View>
        </View>

        {/* Confirm Order CTA */}
        <Button
          title="Place Order"
          onPress={handlePlaceOrder}
          loading={loading}
          style={styles.placeOrderBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Checkout;
