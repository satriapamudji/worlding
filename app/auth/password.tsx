import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type AuthMode = 'signIn' | 'signUp';

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
}

/**
 * Password Auth Screen - Sign in or sign up with email/password
 *
 * Features:
 * - Email + password sign-in
 * - Toggle to sign-up mode
 * - Back navigation to main auth screen
 */
export default function PasswordAuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'success',
  });

  const isEmailValid = useMemo(() => email.trim().includes('@'), [email]);
  const isPasswordValid = useMemo(() => password.length >= 6, [password]);
  const isFormValid = isEmailValid && isPasswordValid;

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;
    setIsLoading(true);
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          showToast(error.message, 'error');
          return;
        }
        router.replace('/(tabs)');
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          showToast(error.message, 'error');
          return;
        }
        showToast('Check your email to confirm your account', 'success');
      }
    } catch (e) {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [email, isFormValid, mode, password, router, showToast]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'signIn' ? 'signUp' : 'signIn'));
  }, []);

  const isSignUp = mode === 'signUp';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={Spacing.lg}
      >
        {/* Back Button */}
        <Animated.View entering={FadeIn.duration(400)}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.header}>
          <Text style={styles.title}>
            {isSignUp ? 'Create your account' : 'Sign in with password'}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeIn.delay(150).duration(400)} style={styles.form}>
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
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={isLoading || !isFormValid}
            style={styles.primaryButton}
          >
            <LinearGradient
              colors={isFormValid ? [Colors.accent, Colors.accentDark] : [Colors.surface, Colors.surface]}
              style={styles.primaryGradient}
            >
              {isLoading && <ActivityIndicator color={Colors.textPrimary} size="small" style={styles.spinner} />}
              <Text style={[styles.primaryText, !isFormValid && styles.primaryTextDisabled]}>
                {isLoading
                  ? (isSignUp ? 'Creating...' : 'Signing in...')
                  : (isSignUp ? 'Create account' : 'Sign in')}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Mode Toggle */}
        <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.modeToggle}>
          <Pressable onPress={toggleMode} style={styles.modeToggleButton}>
            <Text style={styles.modeToggleText}>
              {isSignUp ? 'Already have an account?' : 'New here? Create account'}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.textSecondary} />
          </Pressable>
        </Animated.View>
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
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    alignSelf: 'flex-start',
  },
  backText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  header: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  form: {
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
    marginTop: Spacing.sm,
    ...Shadows.glowSubtle,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    height: 52,
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
  modeToggle: {
    alignItems: 'center',
  },
  modeToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  modeToggleText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
});
