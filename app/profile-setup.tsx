/**
 * Profile Setup Screen
 *
 * Shown after first authentication when user has no profile.
 * Collects name and optional avatar, then creates profile in Supabase.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImagePicker, Toast } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { createProfile, uploadAvatar } from '@/lib/api/profiles';
import { logger } from '@/lib/logger';

type AuthMetadata = {
  full_name?: string;
  name?: string;
  avatar_url?: string;
  picture?: string;
};

const getMetadataString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const hasAppliedPrefillRef = useRef(false);

  const [name, setName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const authProvider = (user?.app_metadata as { provider?: string } | undefined)?.provider;
  const isGoogleAuth = authProvider === 'google';
  const authMetadata = (user?.user_metadata as AuthMetadata | undefined) ?? {};
  const preferredName = isGoogleAuth
    ? getMetadataString(authMetadata.full_name) || getMetadataString(authMetadata.name) || ''
    : '';
  const preferredAvatarUrl = isGoogleAuth
    ? getMetadataString(authMetadata.avatar_url) || getMetadataString(authMetadata.picture)
    : null;

  useEffect(() => {
    if (hasAppliedPrefillRef.current || !user) {
      return;
    }

    if (preferredName) {
      setName(preferredName);
    }

    if (preferredAvatarUrl) {
      setAvatarUri(preferredAvatarUrl);
    }

    hasAppliedPrefillRef.current = true;
  }, [user, preferredName, preferredAvatarUrl]);

  const isValid = name.trim().length >= 2;

  const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  }, []);

  const handleContinue = useCallback(async () => {
    if (!isValid || !user) return;

    setError(null);
    setIsSubmitting(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const isRemoteAvatar = !!avatarUri && /^https?:\/\//i.test(avatarUri);
      const avatarUrl = isRemoteAvatar ? avatarUri : null;

      // Create the profile first
      const { error: createError } = await createProfile({
        id: user.id,
        name: name.trim(),
        avatar_url: avatarUrl,
      });

      if (createError) {
        setError(createError);
        setIsSubmitting(false);
        return;
      }

      // Upload avatar if selected from device
      if (avatarUri && !isRemoteAvatar) {
        const { error: uploadError } = await uploadAvatar(avatarUri);
        if (uploadError) {
          // Profile created but avatar failed - show toast, continue to app
          logger.auth.warn('Avatar upload failed', { error: uploadError });
          setToastMessage('Avatar upload failed. You can add it later in settings.');
          setToastVisible(true);
        }
      }

      // Refresh profile in auth context
      await refreshProfile();

      logger.auth.info('Profile setup complete', { userId: user.id });
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (e) {
      logger.auth.error('Profile setup error', e);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }, [isValid, user, name, avatarUri, triggerHaptic, refreshProfile, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
          <Text style={styles.title}>Create your profile</Text>
          <Text style={styles.subtitle}>
            Let your friends know who you are when you join their Worlds
          </Text>
        </Animated.View>

        {/* Avatar Picker */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.avatarSection}>
          <ImagePicker
            value={avatarUri}
            onChange={setAvatarUri}
            placeholder="Add photo"
            icon="person-outline"
            size="large"
            shape="circle"
            aspect={[1, 1]}
            disabled={isSubmitting}
          />
        </Animated.View>

        {/* Name Input */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.inputSection}>
          <Text style={styles.inputLabel}>Your name</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect={false}
              maxLength={50}
              editable={!isSubmitting}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            {name.length > 0 && (
              <Pressable
                onPress={() => setName('')}
                style={styles.clearButton}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Text style={styles.inputHint}>
            This is how others will see you in shared Worlds
          </Text>
        </Animated.View>

        {/* Error Message */}
        {error && (
          <Animated.View entering={FadeIn} style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Continue Button */}
        <Animated.View
          entering={FadeInUp.delay(400)}
          style={[styles.buttonSection, { paddingBottom: insets.bottom + Spacing.lg }]}
        >
          <Pressable
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!isValid || isSubmitting}
          >
            <LinearGradient
              colors={isValid ? [Colors.accent, Colors.accentDark] : [Colors.surface, Colors.surface]}
              style={styles.buttonGradient}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={Colors.textPrimary} />
              ) : (
                <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>
                  Continue
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Toast for avatar upload failure */}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        type="error"
        duration={4000}
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: Typography.sizes.md * 1.5,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  inputHint: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  buttonSection: {
    paddingTop: Spacing.lg,
  },
  button: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.glow,
  },
  buttonDisabled: {
    ...Shadows.sm,
    shadowColor: '#000',
  },
  buttonGradient: {
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  buttonTextDisabled: {
    color: Colors.textMuted,
  },
});
