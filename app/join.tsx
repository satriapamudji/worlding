import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { validateInviteCode, joinWorldWithCode } from '@/lib/api/invites';
import type { InviteValidationResult } from '@/lib/database.types';

type JoinState = 'loading' | 'valid' | 'invalid' | 'already_member';

/**
 * Join World Screen
 *
 * Shown after scanning a valid invite QR code or entering an invite code.
 * Displays world info and allows user to join.
 */
export default function JoinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();

  const [state, setState] = useState<JoinState>('loading');
  const [worldInfo, setWorldInfo] = useState<InviteValidationResult | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Fetch world info from invite code
  useEffect(() => {
    const fetchWorldInfo = async () => {
      if (!params.code) {
        setState('invalid');
        return;
      }

      const { data, error } = await validateInviteCode(params.code);

      if (error || !data) {
        setState('invalid');
        return;
      }

      setWorldInfo(data);

      // Check if valid based on the valid boolean and error_message
      if (!data.valid) {
        // Check if it's an "already member" case or truly invalid
        if (data.error_message?.includes('already')) {
          setState('already_member');
        } else {
          setState('invalid');
        }
      } else {
        setState('valid');
      }
    };

    fetchWorldInfo();
  }, [params.code]);

  const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  }, []);

  const handleClose = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)');
  }, [router, triggerHaptic]);

  const handleJoin = useCallback(async () => {
    if (!params.code) return;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsJoining(true);
    setJoinError(null);

    const { data, error } = await joinWorldWithCode(params.code);

    if (error || !data) {
      setJoinError(error || 'Failed to join world');
      setIsJoining(false);
      return;
    }

    if (data.success && data.world_id) {
      // Navigate to the newly joined world
      router.replace({
        pathname: '/world/[id]',
        params: {
          id: data.world_id,
          title: worldInfo?.world_title || 'World',
        },
      });
    } else {
      setJoinError(data.error_message || 'Unable to join world');
      setIsJoining(false);
    }
  }, [params.code, router, triggerHaptic, worldInfo]);

  const handleGoToWorld = useCallback(() => {
    if (!worldInfo?.world_id) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    router.replace({
      pathname: '/world/[id]',
      params: {
        id: worldInfo.world_id,
        title: worldInfo.world_title || 'World',
      },
    });
  }, [router, triggerHaptic, worldInfo]);

  // Render loading state
  const renderLoading = () => (
    <View style={styles.centerContent}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>Loading invite...</Text>
    </View>
  );

  // Render invalid/expired state
  const renderInvalid = () => (
    <View style={styles.centerContent}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.iconContainer}>
        <View style={styles.iconBackground}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
        </View>
      </Animated.View>

      <Animated.Text entering={FadeInUp.delay(100).duration(400)} style={styles.errorTitle}>
        Invalid Invite
      </Animated.Text>

      <Animated.Text entering={FadeInUp.delay(200).duration(400)} style={styles.errorText}>
        {worldInfo?.error_message || 'This invite link is invalid or has expired.'}
      </Animated.Text>

      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.buttonContainer}>
        <Pressable onPress={handleClose} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Go Home</Text>
        </Pressable>
      </Animated.View>
    </View>
  );

  // Render already member state
  const renderAlreadyMember = () => (
    <View style={styles.centerContent}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.iconContainer}>
        <View style={styles.iconBackground}>
          <Ionicons name="checkmark-circle-outline" size={40} color={Colors.success} />
        </View>
      </Animated.View>

      <Animated.Text entering={FadeInUp.delay(100).duration(400)} style={styles.title}>
        You're already in this World
      </Animated.Text>

      <Animated.Text entering={FadeInUp.delay(150).duration(400)} style={styles.worldName}>
        "{worldInfo?.world_title}"
      </Animated.Text>

      <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.buttonContainer}>
        <Pressable onPress={handleGoToWorld} style={styles.primaryButton}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            style={styles.primaryGradient}
          >
            <Text style={styles.primaryButtonText}>Go to World</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );

  // Render valid invite state
  const renderValid = () => (
    <View style={styles.centerContent}>
      {/* Photo stack icon */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.iconContainer}>
        <View style={styles.photoStackBackground}>
          <View style={styles.photoStack}>
            <View style={[styles.stackedPhoto, styles.stackedPhotoBack]}>
              <Ionicons name="image" size={20} color={Colors.textMuted} />
            </View>
            <View style={[styles.stackedPhoto, styles.stackedPhotoMiddle]}>
              <Ionicons name="image" size={22} color={Colors.textSecondary} />
            </View>
            <View style={[styles.stackedPhoto, styles.stackedPhotoFront]}>
              <Ionicons name="image" size={24} color={Colors.textPrimary} />
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Invite label */}
      <Animated.Text entering={FadeInUp.delay(100).duration(400)} style={styles.inviteLabel}>
        You're invited to join
      </Animated.Text>

      {/* World name */}
      <Animated.Text entering={FadeInUp.delay(150).duration(400)} style={styles.worldName}>
        "{worldInfo?.world_title}"
      </Animated.Text>

      {/* Creator info */}
      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.creatorRow}>
        <Avatar
          name={worldInfo?.creator_name || 'User'}
          uri={worldInfo?.creator_avatar || undefined}
          size="small"
        />
        <Text style={styles.creatorText}>
          Created by {worldInfo?.creator_name}
        </Text>
      </Animated.View>

      {/* Member count */}
      <Animated.Text entering={FadeInUp.delay(250).duration(400)} style={styles.memberCount}>
        {worldInfo?.member_count || 0} {worldInfo?.member_count === 1 ? 'member' : 'members'}
      </Animated.Text>

      {/* Join error */}
      {joinError && (
        <Animated.Text entering={FadeIn} style={styles.joinErrorText}>
          {joinError}
        </Animated.Text>
      )}

      {/* Join button */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.buttonContainer}>
        <Pressable
          onPress={handleJoin}
          disabled={isJoining}
          style={styles.primaryButton}
        >
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            style={styles.primaryGradient}
          >
            {isJoining && (
              <ActivityIndicator
                color={Colors.textPrimary}
                size="small"
                style={styles.spinner}
              />
            )}
            <Text style={styles.primaryButtonText}>
              {isJoining ? 'Joining...' : 'Join World'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Not now link */}
      <Animated.View entering={FadeInUp.delay(350).duration(400)}>
        <Pressable onPress={handleClose} style={styles.notNowButton}>
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>
      </Animated.View>
    </View>
  );

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return renderLoading();
      case 'invalid':
        return renderInvalid();
      case 'already_member':
        return renderAlreadyMember();
      case 'valid':
        return renderValid();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close button */}
      {state !== 'loading' && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <View style={styles.headerSpacer} />
          <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </Animated.View>
      )}

      {/* Content */}
      {renderContent()}

      {/* Bottom padding */}
      <View style={{ height: insets.bottom + Spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerSpacer: {
    width: 44,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Loading
  loadingText: {
    marginTop: Spacing.lg,
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },

  // Icon container
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Photo stack icon
  photoStackBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  photoStack: {
    width: 60,
    height: 50,
    position: 'relative',
  },
  stackedPhoto: {
    position: 'absolute',
    width: 36,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stackedPhotoBack: {
    top: 0,
    left: 0,
    transform: [{ rotate: '-8deg' }],
  },
  stackedPhotoMiddle: {
    top: 4,
    left: 12,
    transform: [{ rotate: '4deg' }],
  },
  stackedPhotoFront: {
    top: 10,
    left: 22,
    transform: [{ rotate: '12deg' }],
    backgroundColor: Colors.surfaceElevated,
  },

  // Text styles
  inviteLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  worldName: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  creatorText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  memberCount: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.xxl,
  },

  // Error state
  errorTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  joinErrorText: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },

  // Buttons
  buttonContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
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
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  notNowButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  notNowText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
});
