import React from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './forgot.style';
import useForgot from './useForgot';
import { Button, Input, Header } from '@components';
import { color } from '@theme';
import { MailIcon, LockIcon } from '@svgIndex';

export const Forgot: React.FC = () => {
  const { formik, loading, goBack } = useForgot();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header title="Forgot Password" showBack onBackPress={goBack} />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.infoSection}>
            <View style={styles.iconCircle}>
              <LockIcon width={32} height={32} color={color.primary} />
            </View>
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.description}>
              Enter the registered email address or mobile number linked to your account.
              We'll send a verification code to reset your password.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Input
              label="Email or Mobile Number"
              placeholder="e.g. user@medsaas.test or 9876543210"
              required
              value={formik.values.identifier}
              onChangeText={formik.handleChange('identifier')}
              onBlur={formik.handleBlur('identifier')}
              error={formik.touched.identifier ? formik.errors.identifier : undefined}
              leftIcon={<MailIcon width={18} height={18} color={color.textSecondary} />}
              keyboardType="email-address"
            />

            <Button
              title="Send Verification Code"
              onPress={formik.handleSubmit as any}
              loading={loading}
              style={styles.button}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Forgot;
