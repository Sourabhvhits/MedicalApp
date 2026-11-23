import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './register.style';
import useRegister from './useRegister';
import { Button, Input, Header } from '@components';
import { color } from '@theme';
import {
  UserIcon,
  MailIcon,
  PhoneIcon,
  LockIcon,
  StoreIcon,
  ShoppingBagIcon,
  StethoscopeIcon,
  TruckIcon,
} from '@svgIndex';

const ROLE_OPTIONS = [
  {
    type: 'CUSTOMER' as const,
    title: 'Customer',
    desc: 'Buy medicines from nearby stores and collect them yourself.',
    icon: ShoppingBagIcon,
  },
  {
    type: 'RETAILER' as const,
    title: 'Medical shop',
    desc: 'Sell to customers, manage stock, batches and purchases.',
    icon: StethoscopeIcon,
  },
  {
    type: 'VENDOR' as const,
    title: 'Wholesaler',
    desc: 'Supply medical shops with wholesale stock.',
    icon: TruckIcon,
  },
];

export const Register: React.FC = () => {
  const { formik, loading, selectUserType, navigateToLogin } = useRegister();
  const isBusiness = formik.values.userType !== 'CUSTOMER';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header title="Create account" showBack onBackPress={navigateToLogin} />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Title Section (matching web) */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Choose the account type that matches how you will use the platform.
            </Text>
          </View>

          {/* Account Role Selector Cards (matching web screenshot) */}
          <View style={styles.roleSelectorContainer}>
            <View style={styles.roleCardsCol}>
              {ROLE_OPTIONS.map((item) => {
                const isActive = formik.values.userType === item.type;
                const IconComponent = item.icon;
                return (
                  <TouchableOpacity
                    key={item.type}
                    style={[styles.roleCard, isActive && styles.roleCardActive]}
                    onPress={() => selectUserType(item.type)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[styles.roleIconBox, isActive && styles.roleIconBoxActive]}
                    >
                      <IconComponent
                        width={20}
                        height={20}
                        color={isActive ? color.white : color.textSecondary}
                      />
                    </View>
                    <View style={styles.roleTextBox}>
                      <Text
                        style={[
                          styles.roleCardTitle,
                          isActive && styles.roleCardTitleActive,
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.roleCardDesc}>{item.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Form Card Section */}
          <View style={styles.formSection}>
            {/* Store name for Medical shop / Wholesaler */}
            {isBusiness && (
              <Input
                label="Store name"
                placeholder="Apollo Medical Store"
                required
                value={formik.values.businessName}
                onChangeText={formik.handleChange('businessName')}
                onBlur={formik.handleBlur('businessName')}
                error={formik.touched.businessName ? formik.errors.businessName : undefined}
                leftIcon={<StoreIcon width={18} height={18} color={color.textSecondary} />}
              />
            )}

            <View style={styles.rowInputs}>
              <Input
                label="First name"
                placeholder="First name"
                required
                containerStyle={styles.halfInput}
                value={formik.values.firstName}
                onChangeText={formik.handleChange('firstName')}
                onBlur={formik.handleBlur('firstName')}
                error={formik.touched.firstName ? formik.errors.firstName : undefined}
                leftIcon={<UserIcon width={18} height={18} color={color.textSecondary} />}
              />

              <Input
                label="Last name"
                placeholder="Last name"
                containerStyle={styles.halfInput}
                value={formik.values.lastName}
                onChangeText={formik.handleChange('lastName')}
                onBlur={formik.handleBlur('lastName')}
                error={formik.touched.lastName ? formik.errors.lastName : undefined}
              />
            </View>

            <Input
              label="Mobile number"
              placeholder="9876543210"
              required
              keyboardType="phone-pad"
              maxLength={10}
              value={formik.values.phone}
              onChangeText={formik.handleChange('phone')}
              onBlur={formik.handleBlur('phone')}
              error={formik.touched.phone ? formik.errors.phone : undefined}
              leftIcon={<PhoneIcon width={18} height={18} color={color.textSecondary} />}
            />

            <Input
              label={isBusiness ? 'Email' : 'Email (Optional)'}
              placeholder="you@example.com"
              required={isBusiness}
              keyboardType="email-address"
              value={formik.values.email}
              onChangeText={formik.handleChange('email')}
              onBlur={formik.handleBlur('email')}
              error={formik.touched.email ? formik.errors.email : undefined}
              leftIcon={<MailIcon width={18} height={18} color={color.textSecondary} />}
            />

            <Input
              label="Password"
              placeholder="8+ characters with upper, lower and a number"
              required
              isPassword
              value={formik.values.password}
              onChangeText={formik.handleChange('password')}
              onBlur={formik.handleBlur('password')}
              error={formik.touched.password ? formik.errors.password : undefined}
              leftIcon={<LockIcon width={18} height={18} color={color.textSecondary} />}
            />

            <Input
              label="Confirm password"
              placeholder="Re-enter your password"
              required
              isPassword
              value={formik.values.confirmPassword}
              onChangeText={formik.handleChange('confirmPassword')}
              onBlur={formik.handleBlur('confirmPassword')}
              error={
                formik.touched.confirmPassword ? formik.errors.confirmPassword : undefined
              }
              leftIcon={<LockIcon width={18} height={18} color={color.textSecondary} />}
            />

            {/* Business Verification Alert Notice matching Web */}
            {isBusiness && (
              <View style={styles.businessNoticeBox}>
                <Text style={styles.businessNoticeText}>
                  After registering you will be asked for your drug licence, GST and address details. A platform admin reviews them before your account can trade.
                </Text>
              </View>
            )}

            <Button
              title="Create account"
              onPress={formik.handleSubmit as any}
              loading={loading}
              style={styles.submitButton}
            />
          </View>

          {/* Sign In Link Footer */}
          <View style={styles.footerSection}>
            <Text style={styles.footerText}>Already registered?</Text>
            <TouchableOpacity onPress={navigateToLogin} activeOpacity={0.7}>
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Register;
