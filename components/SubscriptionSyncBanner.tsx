import { BlurView } from 'expo-blur';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface SubscriptionSyncBannerProps {
  visible: boolean;
  status: 'syncing' | 'delayed';
  onRetry: () => void;
}

export function SubscriptionSyncBanner({
  visible,
  status,
  onRetry,
}: SubscriptionSyncBannerProps) {
  const insets = useSafeAreaInsets();

  if (!visible) {
    return null;
  }

  const title =
    status === 'delayed'
      ? 'Still syncing purchase'
      : 'Unlocking Worlding+...';
  const subtitle =
    status === 'delayed'
      ? 'This can take a moment. Try again.'
      : 'Confirming your subscription.';

  return (
    <View style={[styles.container, { bottom: insets.bottom + Spacing.lg }]}>
      <BlurView intensity={80} tint="dark" style={styles.blur}>
        <View style={styles.content}>
          <View style={styles.statusRow}>
            {status === 'syncing' ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <View style={styles.statusDot} />
            )}
            <View style={styles.textBlock}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>

          {status === 'delayed' && (
            <Pressable style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          )}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 2000,
  },
  blur: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  content: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glass,
    ...Shadows.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.warning,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  retryButton: {
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  retryText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
});

export default SubscriptionSyncBanner;
