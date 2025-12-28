import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

/**
 * Invite Screen
 *
 * Shown after creating a world to invite friends
 */
export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    worldId?: string;
    worldName?: string;
  }>();

  const [copied, setCopied] = useState(false);

  // Mock invite link - will be real when backend is connected
  const inviteCode = 'ABC123';
  const inviteLink = `https://worlding.app/join/${inviteCode}`;

  const handleCopyLink = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await Share.share({
        message: `Join my World "${params.worldName}" on Worlding!\n\n${inviteLink}`,
        url: inviteLink, // iOS only
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDone = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Navigate to the world
    router.replace({
      pathname: '/world/[id]',
      params: {
        id: params.worldId || 'new',
        title: params.worldName,
      },
    });
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.iconContainer}>
          <Text style={styles.icon}>🎉</Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.title}
        >
          {params.worldName || 'World'} created!
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(200).duration(400)}
          style={styles.subtitle}
        >
          Invite friends to share their photos
        </Animated.Text>

        {/* Invite Link Box */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={styles.linkBox}
        >
          <Text style={styles.linkLabel}>Invite Link</Text>
          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1}>
              {inviteLink}
            </Text>
            <Pressable
              onPress={handleCopyLink}
              style={styles.copyButton}
              hitSlop={8}
            >
              <Text style={styles.copyButtonText}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Share Button */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={styles.shareContainer}
        >
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.shareButtonPressed,
            ]}
          >
            <Text style={styles.shareButtonText}>Share Invite</Text>
          </Pressable>
        </Animated.View>

        {/* Or divider */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={styles.dividerRow}
        >
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        {/* Done Button */}
        <Animated.View entering={FadeInUp.delay(600).duration(400)}>
          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [
              styles.doneButton,
              pressed && styles.doneButtonPressed,
            ]}
          >
            <Text style={styles.doneButtonText}>Go to World</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Footer hint */}
      <Animated.View
        entering={FadeIn.delay(700).duration(400)}
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <Text style={styles.footerText}>
          You can always invite more people later from the world settings
        </Text>
      </Animated.View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  linkBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  linkLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  linkText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
  },
  copyButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
  },
  copyButtonText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  shareContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  shareButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  shareButtonPressed: {
    opacity: 0.9,
  },
  shareButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
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
    paddingHorizontal: Spacing.md,
  },
  doneButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  doneButtonPressed: {
    opacity: 0.7,
  },
  doneButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
});
