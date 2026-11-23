import React from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './otpVerify.style';
import useOtpVerify from './useOtpVerify';
import { Button, Input, Header } from '@components';
import { color } from '@theme';
import { LockIcon } from '@svgIndex';

export const OtpVerify: React.FC = () => {
  const {
    identifier,
    devCode,
    countdown,
    loading,
    resending,
    formik,
    handleResend,
    goBack,
  } = useOtpVerify();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header title="Verify OTP" showBack onBackPress={goBack} />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.infoSection}>
            <View style={styles.iconCircle}>
              <LockIcon width={32} height={32} color={color.primary} />
            </View>
            <Text style={styles.title}>Enter Verification Code</Text>
            <Text style={styles.subtitle}>
              We sent a verification code to{' '}
              <Text style={styles.identifierHighlight}>{identifier || 'your account'}</Text>
            </Text>

            {devCode ? (
              <View style={styles.devCodeBanner}>
                <Text style={styles.devCodeText}>
                  Dev Mode Verification Code: <Text style={styles.bold}>{devCode}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.formCard}>
            <Input
              label="Verification Code"
              placeholder="Enter OTP (e.g. 123456)"
              required
              keyboardType="number-pad"
              maxLength={8}
              value={formik.values.code}
              onChangeText={formik.handleChange('code')}
              onBlur={formik.handleBlur('code')}
              error={formik.touched.code ? formik.errors.code : undefined}
              leftIcon={<LockIcon width={18} height={18} color={color.textSecondary} />}
            />

            <Button
              title="Verify Code"
              onPress={formik.handleSubmit as any}
              loading={loading}
              style={styles.verifyButton}
            />
          </View>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't receive the code?</Text>
            {countdown > 0 ? (
              <Text style={styles.timerText}>Resend in {countdown}s</Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                activeOpacity={0.7}
              >
                <Text style={styles.resendLink}>
                  {resending ? 'Sending...' : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OtpVerify;
