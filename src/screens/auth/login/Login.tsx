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
import { styles } from './login.style';
import useLogin, { DEMO_USERS } from './useLogin';
import { Button, Input } from '@components';
import { color } from '@theme';
import { StethoscopeIcon, MailIcon, LockIcon } from '@svgIndex';

export const Login: React.FC = () => {
  const {
    formik,
    loading,
    handleDemoSelect,
    navigateToRegister,
    navigateToForgot,
  } = useLogin();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Brand Section */}
          <View style={styles.headerSection}>
            <View style={styles.brandIconWrapper}>
              <StethoscopeIcon width={34} height={34} color={color.primary} />
            </View>
            <Text style={styles.appName}>MedMarket SaaS</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in with your registered email or 10-digit mobile number
            </Text>
          </View>

          {/* Form Card Section */}
          <View style={styles.formSection}>
            <Input
              label="Email or Mobile Number"
              placeholder="e.g. user@medsaas.test or 9876543210"
              required
              value={formik.values.identifier}
              onChangeText={formik.handleChange('identifier')}
              onBlur={formik.handleBlur('identifier')}
              error={formik.touched.identifier ? formik.errors.identifier : undefined}
              leftIcon={<MailIcon width={18} height={18} color={color.textSecondary} />}
              autoComplete="username"
              keyboardType="email-address"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              required
              isPassword
              value={formik.values.password}
              onChangeText={formik.handleChange('password')}
              onBlur={formik.handleBlur('password')}
              error={formik.touched.password ? formik.errors.password : undefined}
              leftIcon={<LockIcon width={18} height={18} color={color.textSecondary} />}
              autoComplete="current-password"
            />

            <TouchableOpacity
              onPress={navigateToForgot}
              style={styles.forgotRow}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={formik.handleSubmit as any}
              loading={loading}
              style={styles.submitButton}
            />
          </View>

          {/* Quick Demo Accounts for effortless testing */}
          <View style={styles.demoSection}>
            <Text style={styles.demoLabel}>Demo Quick Sign In</Text>
            <View style={styles.demoButtonsRow}>
              {DEMO_USERS.map((demo) => (
                <TouchableOpacity
                  key={demo.label}
                  style={styles.demoPill}
                  onPress={() => handleDemoSelect(demo.id, demo.pass)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.demoPillText}>{demo.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Register Link Footer */}
          <View style={styles.footerSection}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={navigateToRegister} activeOpacity={0.7}>
              <Text style={styles.signUpLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Login;
