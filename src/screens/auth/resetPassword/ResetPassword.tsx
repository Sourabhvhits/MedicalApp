import React from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './resetPassword.style';
import useResetPassword from './useResetPassword';
import { Button, Input, Header } from '@components';
import { color } from '@theme';
import { LockIcon } from '@svgIndex';

export const ResetPassword: React.FC = () => {
  const { formik, loading, goBack } = useResetPassword();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header title="Reset Password" showBack onBackPress={goBack} />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoSection}>
            <View style={styles.iconCircle}>
              <LockIcon width={32} height={32} color={color.primary} />
            </View>
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Your new password must be at least 8 characters long and contain uppercase, lowercase, and numbers.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Input
              label="Verification Code"
              placeholder="Enter received OTP code"
              required
              keyboardType="number-pad"
              value={formik.values.code}
              onChangeText={formik.handleChange('code')}
              onBlur={formik.handleBlur('code')}
              error={formik.touched.code ? formik.errors.code : undefined}
              leftIcon={<LockIcon width={18} height={18} color={color.textSecondary} />}
            />

            <Input
              label="New Password"
              placeholder="Minimum 8 characters"
              required
              isPassword
              value={formik.values.newPassword}
              onChangeText={formik.handleChange('newPassword')}
              onBlur={formik.handleBlur('newPassword')}
              error={formik.touched.newPassword ? formik.errors.newPassword : undefined}
              leftIcon={<LockIcon width={18} height={18} color={color.textSecondary} />}
            />

            <Input
              label="Confirm New Password"
              placeholder="Re-enter your new password"
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

            <Button
              title="Update Password"
              onPress={formik.handleSubmit as any}
              loading={loading}
              style={styles.submitButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ResetPassword;
