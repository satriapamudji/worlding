import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Animated, {
  FadeIn,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtpInput, Toast, WorldingLogo } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// Required for web browser auth session
WebBrowser.maybeCompleteAuthSession();

type AuthStep = 'email' | 'code';

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
}

const RESEND_COOLDOWN_SECONDS = 30;
const EXCHANGE_CODE_TIMEOUT_MS = 8000;

type ExchangeCodeResult = Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>;

const exchangeCodeForSessionWithTimeout = async (
  authCode: string,
  timeoutMs: number = EXCHANGE_CODE_TIMEOUT_MS,
): Promise<ExchangeCodeResult> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('exchangeCodeForSession timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      supabase.auth.exchangeCodeForSession(authCode),
      timeoutPromise,
    ]) as ExchangeCodeResult;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

/**
 * Auth Screen - Main sign-in page
 *
 * Features:
 * - Google OAuth sign-in
 * - OTP code email sign-in (primary)
 * - Link to password sign-in (secondary)
 */
export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Form state
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);

  const verifyPendingRef = useRef(false);

  // Toast state
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'success',
  });

  // Animation values for social button
  const googleScale = useSharedValue(1);

  const googleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: googleScale.value }],
    opacity: googleScale.value < 1 ? 0.8 : 1,
  }));

  // Validation
  const isEmailValid = useMemo(() => email.trim().includes('@'), [email]);
  const isOtpComplete = useMemo(() => otp.length === 6, [otp]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Helpers
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Button press handlers
  const handlePressIn = useCallback(
    (scaleValue: SharedValue<number>) => {
      scaleValue.value = withTiming(0.97, { duration: 100 });
      triggerHaptic();
    },
    [triggerHaptic]
  );

  const handlePressOut = useCallback((scaleValue: SharedValue<number>) => {
    scaleValue.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  // Auth handlers
  const handleGoogleSignIn = useCallback(async () => {
    try {
      triggerHaptic();
      
      // Create redirect URI for the app
      // Uses exp:// in Expo Go, worlding:// in standalone builds
      const redirectTo = makeRedirectUri({
        native: 'worlding://auth/callback',
      });

      // Get OAuth URL from Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        showToast(error.message, 'error');
        return;
      }

      if (data?.url) {
        // Open browser for Google sign-in
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

        if (result.type === 'success' && result.url) {
          const hashIndex = result.url.indexOf('#');
          const queryIndex = result.url.indexOf('?');
          const queryString = queryIndex === -1
            ? ''
            : result.url.substring(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex);
          const params = new URLSearchParams(queryString);

          const authCode = params.get('code');
          const oauthError = params.get('error');
          const oauthErrorDescription = params.get('error_description');

          if (oauthError) {
            showToast(oauthErrorDescription || 'Sign-in failed. Please try again.', 'error');
            return;
          }

          if (authCode) {
            try {
              const { data, error } = await exchangeCodeForSessionWithTimeout(authCode);

              if (error) {
                showToast('Sign-in failed. Please try again.', 'error');
                return;
              }

              router.replace('/(tabs)');
            } catch (err) {
              showToast('Sign-in failed. Please try again.', 'error');
            }
          } else {
            showToast('Sign-in failed. Please try again.', 'error');
          }
        } else if (result.type === 'cancel') {
          // User cancelled, no need to show error
        }
      }
    } catch (e) {
      console.error('Google sign-in error:', e);
      showToast('Google sign-in failed. Please try again.', 'error');
    }
  }, [showToast, triggerHaptic, router]);

  const handleSendCode = useCallback(async () => {
    if (!isEmailValid) return;

    const trimmedEmail = email.trim();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
      });

      if (error) {
        showToast(error.message, 'error');
        return;
      }
      setStep('code');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      showToast('Code sent to your email', 'success');
    } catch (e) {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [email, isEmailValid, showToast]);

  const handleVerify = useCallback(async () => {
    if (!isOtpComplete) return;

    if (verifyPendingRef.current) {
      return;
    }

    const trimmedEmail = email.trim();

    verifyPendingRef.current = true;
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: otp,
        type: 'email',
      });

      if (error) {
        setOtpError(true);
        if (error.message.toLowerCase().includes('expired')) {
          showToast('Code expired. Please request a new one.', 'error');
        } else {
          showToast('Invalid code. Please try again.', 'error');
        }
        setOtp('');
        return;
      }

      // Success flash before navigating
      setOtpSuccess(true);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 400);
    } catch (e) {
      setOtpError(true);
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      verifyPendingRef.current = false;
      setIsLoading(false);
    }
  }, [email, isOtpComplete, otp, router, showToast]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;

    const trimmedEmail = email.trim();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
      });

      if (error) {
        showToast(error.message, 'error');
        return;
      }
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtp('');
      showToast('New code sent to your email', 'success');
    } catch (e) {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [email, resendCooldown, showToast]);

  const handleBackToEmail = useCallback(() => {
    setStep('email');
    setOtp('');
    setOtpError(false);
    setOtpSuccess(false);
  }, []);

  const handleOtpChange = useCallback((value: string) => {
    setOtp(value);
    if (otpError) setOtpError(false);
  }, [otpError]);

  const handleOtpFlashComplete = useCallback(() => {
    setOtpError(false);
    setOtpSuccess(false);
  }, []);

  const handlePasswordLink = useCallback(() => {
    router.push('/auth/password' as Href);
  }, [router]);

  // Render email step
  const renderEmailStep = () => (
    <>
      {/* Logo */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.logoContainer}>
        <WorldingLogo width={120} height={24} />
      </Animated.View>

      {/* Header */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </Animated.View>

      {/* Google Sign-In */}
      <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.socialSection}>
        <Pressable
          onPress={handleGoogleSignIn}
          onPressIn={() => handlePressIn(googleScale)}
          onPressOut={() => handlePressOut(googleScale)}
        >
          <Animated.View style={[styles.socialButton, googleAnimatedStyle]}>
            <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
            <Text style={styles.socialText}>Continue with Google</Text>
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* Divider */}
      <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </Animated.View>

      {/* Email Section */}
      <Animated.View entering={FadeIn.delay(350).duration(400)} style={styles.emailSection}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSendCode}
          />
        </View>

        <Pressable
          onPress={handleSendCode}
          disabled={isLoading || !isEmailValid}
          style={styles.primaryButton}
        >
          <LinearGradient
            colors={isEmailValid ? [Colors.accent, Colors.accentDark] : [Colors.surface, Colors.surface]}
            style={styles.primaryGradient}
          >
            {isLoading && <ActivityIndicator color={Colors.textPrimary} size="small" style={styles.spinner} />}
            <Text style={[styles.primaryText, !isEmailValid && styles.primaryTextDisabled]}>
              {isLoading ? 'Sending...' : 'Send code'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Footer */}
      <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.footer}>
        <Pressable onPress={handlePasswordLink} style={styles.passwordLink}>
          <Text style={styles.passwordLinkText}>Use password instead</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.textSecondary} />
        </Pressable>

        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink}>Terms</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </Animated.View>
    </>
  );

  // Render code step content (without back button - it's rendered separately)
  const renderCodeStepContent = () => (
    <>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.codeHeader}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>Sent to {email}</Text>
      </Animated.View>

      {/* OTP Input */}
      <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.otpSection}>
        <OtpInput
          value={otp}
          onChange={handleOtpChange}
          disabled={isLoading}
          error={otpError}
          success={otpSuccess}
          onFlashComplete={handleOtpFlashComplete}
        />
      </Animated.View>

      {/* Verify Button */}
      <Animated.View entering={FadeIn.delay(250).duration(400)} style={styles.verifySection}>
        <Pressable
          onPress={handleVerify}
          disabled={isLoading || !isOtpComplete}
          style={styles.primaryButton}
        >
          <LinearGradient
            colors={isOtpComplete ? [Colors.accent, Colors.accentDark] : [Colors.surface, Colors.surface]}
            style={styles.primaryGradient}
          >
            {isLoading && <ActivityIndicator color={Colors.textPrimary} size="small" style={styles.spinner} />}
            <Text style={[styles.primaryText, !isOtpComplete && styles.primaryTextDisabled]}>
              {isLoading ? 'Verifying...' : 'Verify'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Resend */}
      <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.resendSection}>
        {resendCooldown > 0 ? (
          <Text style={styles.resendCooldownText}>Resend code in {resendCooldown}s</Text>
        ) : (
          <Pressable onPress={handleResend} disabled={isLoading}>
            <Text style={styles.resendText}>Resend code</Text>
          </Pressable>
        )}
      </Animated.View>
    </>
  );

  if (step === 'code') {
    return (
      <View style={styles.container}>
        {/* Fixed back button at top */}
        <Animated.View 
          entering={FadeIn.duration(400)} 
          style={[styles.backButtonContainer, { paddingTop: insets.top + Spacing.sm }]}
        >
          <Pressable onPress={handleBackToEmail} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </Animated.View>

        {/* Scrollable content */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.codeScrollContent}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={Spacing.lg}
        >
          {renderCodeStepContent()}
        </KeyboardAwareScrollView>

        {/* Toast */}
        <Toast
          message={toast.message}
          visible={toast.visible}
          type={toast.type}
          onHide={hideToast}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={Spacing.lg}
      >
        {renderEmailStep()}
      </KeyboardAwareScrollView>

      {/* Toast */}
      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        onHide={hideToast}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    justifyContent: 'center',
  },
  codeScrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    justifyContent: 'center',
  },
  backButtonContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  socialSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 52,
  },
  socialText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  emailSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  inputWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 52,
  },
  input: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
  },
  primaryButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.glowSubtle,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    minHeight: 52,
  },
  spinner: {
    marginRight: Spacing.sm,
  },
  primaryText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  primaryTextDisabled: {
    color: Colors.textMuted,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  passwordLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  passwordLinkText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  termsText: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  // Code step styles
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginLeft: -Spacing.sm,
    alignSelf: 'flex-start',
  },
  backText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  codeHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  otpSection: {
    marginBottom: Spacing.xl,
  },
  verifySection: {
    marginBottom: Spacing.lg,
  },
  resendSection: {
    alignItems: 'center',
  },
  resendCooldownText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  resendText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
});
