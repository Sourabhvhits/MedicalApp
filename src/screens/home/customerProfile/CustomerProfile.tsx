import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './customerProfile.style';
import useCustomerProfile from './useCustomerProfile';
import { Header, Button } from '../../../components/componentsIndex';
import { UserIcon } from '../../../assets/svg/UserIcon';
import { MailIcon } from '../../../assets/svg/MailIcon';
import { PhoneIcon } from '../../../assets/svg/PhoneIcon';
import { ClockIcon } from '../../../assets/svg/ClockIcon';
import color from '../../../theme/color';

export const CustomerProfile: React.FC = () => {
  const { user, addresses, loggingOut, handleLogout, navigateToOrders } = useCustomerProfile();
  const isBusiness = user?.userType !== 'CUSTOMER';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="My Account" showBack={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <UserIcon width={36} height={36} color={color.primary} />
          </View>
          <Text style={styles.userName}>
            {user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Customer'}
          </Text>
          <View style={styles.userTypePill}>
            <Text style={styles.userTypeText}>{user?.userType || 'CUSTOMER'}</Text>
          </View>

          {user?.phone ? (
            <View style={styles.contactRow}>
              <PhoneIcon width={14} height={14} color={color.textSecondary} />
              <Text style={styles.contactText}>{user.phone}</Text>
            </View>
          ) : null}

          {user?.email ? (
            <View style={styles.contactRow}>
              <MailIcon width={14} height={14} color={color.textSecondary} />
              <Text style={styles.contactText}>{user.email}</Text>
            </View>
          ) : null}
        </View>

        {/* Business Verification Alert for Retailer/Wholesaler */}
        {isBusiness && (
          <View style={styles.businessAlertBox}>
            <Text style={styles.businessAlertTitle}>Compliance & License Status</Text>
            <Text style={styles.businessAlertDesc}>
              Your drug license and GST details are securely on file. Business approval status:{' '}
              {user?.approvalStatus || 'PENDING'}.
            </Text>
          </View>
        )}

        {/* Quick Orders Link */}
        <TouchableOpacity
          style={styles.quickNavCard}
          onPress={navigateToOrders}
          activeOpacity={0.8}
        >
          <View style={styles.quickNavLeft}>
            <ClockIcon width={22} height={22} color={color.primary} />
            <View>
              <Text style={styles.quickNavTitle}>My Orders</Text>
              <Text style={styles.quickNavSubtitle}>
                Track live orders, view medicine receipts & invoices
              </Text>
            </View>
          </View>
          <Text style={styles.quickNavArrow}>›</Text>
        </TouchableOpacity>

        {/* Saved Addresses Section */}
        <Text style={styles.sectionTitle}>Saved Delivery / Pickup Addresses</Text>
        {addresses.length > 0 ? (
          addresses.map((addr) => (
            <View key={addr.id} style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <Text style={styles.addressLabel}>{addr.label || 'Home'}</Text>
                {addr.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>DEFAULT</Text>
                  </View>
                )}
              </View>
              <Text style={styles.addressText}>
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.postalCode}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyAddress}>
            <Text style={styles.emptyAddressText}>
              No saved addresses. Addresses saved during checkout will appear here.
            </Text>
          </View>
        )}

        {/* Sign Out Button */}
        <Button
          title="Sign Out"
          variant="outline"
          onPress={handleLogout}
          loading={loggingOut}
          style={styles.logoutButton}
          textStyle={{ color: color.error }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default CustomerProfile;
