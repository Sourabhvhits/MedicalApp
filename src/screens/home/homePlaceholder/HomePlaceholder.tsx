import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './homePlaceholder.style';
import useHomePlaceholder from './useHomePlaceholder';
import { Button, Header } from '@components';
import { color } from '@theme';
import { StoreIcon, TruckIcon } from '@svgIndex';

export const HomePlaceholder: React.FC = () => {
  const { user, loading, handleLogout, navigateToCustomerStore } = useHomePlaceholder();
  const isRetailer = user?.userType === 'RETAILER';

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={isRetailer ? 'Medical Shop Workspace' : 'Wholesale Operations'}
        showBack={false}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Business Header Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.greetingRow}>
            <View style={styles.avatarCircle}>
              {isRetailer ? (
                <StoreIcon width={28} height={28} color={color.primary} />
              ) : (
                <TruckIcon width={28} height={28} color={color.primary} />
              )}
            </View>
            <View style={styles.greetingText}>
              <Text style={styles.welcomeTitle}>
                {user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Business Partner'}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {isRetailer ? 'LICENSED MEDICAL SHOP' : 'PHARMACEUTICAL WHOLESALER'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account:</Text>
            <Text style={styles.infoValue}>{user?.email || user?.phone || 'Verified Partner'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={styles.infoValue}>
              {user?.approvalStatus === 'APPROVED'
                ? 'Active & Verified'
                : 'Pending Document Review'}
            </Text>
          </View>
        </View>

        {/* Verification Status Card matching Web Notice */}
        <View style={styles.phaseCard}>
          <Text style={styles.phaseTitle}>Compliance & License Verification</Text>
          <Text style={styles.phaseDescription}>
            Your registered drug license, GST credentials and premise details are linked with MedMarket.
            Platform administrators review regulatory documents to ensure CDSCO compliance before full B2B trading access is activated.
          </Text>
        </View>

        {/* Switch to Customer Catalog button */}
        <Button
          title="Browse Customer Medicine App"
          onPress={navigateToCustomerStore}
          style={styles.browseStoreButton}
        />

        {/* Sign Out Button */}
        <Button
          title="Sign Out"
          variant="outline"
          onPress={handleLogout}
          loading={loading}
          style={styles.logoutButton}
          textStyle={{ color: color.error }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomePlaceholder;
