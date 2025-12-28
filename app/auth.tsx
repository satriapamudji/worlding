import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Dimensions,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { GlassCard } from '@/components';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_HEIGHT < 700;

/**
 * Auth Screen - Login/Signup
 * 
 * Options:
 * - Email + password (sign up / sign in)
 * - Continue with Google (TODO)
 * - Continue with Apple (TODO)
 */
export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [error, setError] = useState<string | null>(null);

  const handleEmailPasswordAuth = async () => {
    if (!email.trim() || !email.includes('@') || password.length < 6) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (mode === 'signUp') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        // After sign up, you may require email confirmation depending on Supabase settings.
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
      }

      // Rely on auth listener, but navigate for immediate UX
      router.replace('/(tabs)');
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    // TODO: Implement Google Sign-In with Supabase OAuth
    console.log('TODO: Implement Google Sign-In with Supabase');
  };

  const handleAppleSignIn = () => {
    // TODO: Implement Apple Sign-In with Supabase OAuth
    console.log('TODO: Implement Apple Sign-In with Supabase');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={Spacing.lg}
      >
        <View style={styles.content}>
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
            <Text style={styles.title}>
              {mode === 'signIn' ? 'Welcome back' : 'Create account'}
            </Text>
          </Animated.View>

          {/* Auth Options */}
          <Animated.View 
            entering={FadeInUp.delay(200).duration(400)} 
            style={styles.authContainer}
          >
            <View style={styles.formCard}>
              {/* Email + Password */}
              <View style={styles.magicLinkContainer}>
              <Text style={styles.inputLabel}>Email address</Text>
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

              <Text style={[styles.inputLabel, { marginTop: Spacing.sm }]}>Password</Text>
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
                  onSubmitEditing={handleEmailPasswordAuth}
                />
              </View>

              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              <Pressable 
                onPress={handleEmailPasswordAuth}
                disabled={isLoading || !email.includes('@') || password.length < 6}
                style={styles.magicLinkButton}
              >
                <LinearGradient
                  colors={
                    email.includes('@') && password.length >= 6
                      ? [Colors.accent, Colors.accentDark]
                      : [Colors.surface, Colors.surface]
                  }
                  style={styles.magicLinkGradient}
                >
                  <Text style={[
                    styles.magicLinkText,
                    (!email.includes('@') || password.length < 6) && styles.magicLinkTextDisabled
                  ]}>
                    {isLoading ? 'Please wait...' : mode === 'signUp' ? 'Create account' : 'Sign in'}
                  </Text>
                </LinearGradient>
              </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Mode Toggle */}
        <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.modeToggleContainer}>
          <Text style={styles.modeToggleLabel}>
            {mode === 'signIn' ? 'First time here?' : 'Already have an account?'}
          </Text>
          <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
            <Text style={styles.modeToggleLink}>
              {mode === 'signIn' ? 'Create an account' : 'Sign in'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Terms */}
        <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
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
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
  },
  
  // Header
  header: {
    marginBottom: Spacing.xxl,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  // Auth Container
  authContainer: {
    marginTop: Spacing.md,
  },

  // Social Buttons
  socialButtons: {
    gap: Spacing.sm,
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
  },
  socialIcon: {
    fontSize: Typography.sizes.lg,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  socialText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
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

  // Form Card
  formCard: {
    width: '100%',
  },

  // Input Fields
  magicLinkContainer: {
    gap: Spacing.md,
  },
  inputLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: '400',
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
  },

  // Primary Button
  magicLinkButton: {
    marginTop: Spacing.xl,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  magicLinkGradient: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  magicLinkText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  magicLinkTextDisabled: {
    color: Colors.textMuted,
  },
  errorText: {
    marginTop: Spacing.sm,
    color: Colors.error,
    fontSize: Typography.sizes.sm,
  },
  // (legacy modeToggle styles now unused)
  modeToggle: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  modeToggleText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },

  // Mode Toggle
  modeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
    gap: Spacing.xs,
  },
  modeToggleLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  modeToggleLink: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },

  // Terms
  termsContainer: {
    marginTop: Spacing.lg,
  },
  termsText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
