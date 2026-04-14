import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

interface VerifyConnectionSheetProps {
  visible: boolean;
  onClose: () => void;
  onRetry: () => void;
  message?: string;
}

export function VerifyConnectionSheet({
  visible,
  onClose,
  onRetry,
  message,
}: VerifyConnectionSheetProps) {
  const insets = useSafeAreaInsets();

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.sheet}>
            <View style={styles.handle} />

            <Text style={styles.title}>Connect to verify subscription</Text>
            <Text style={styles.subtitle}>
              {message ?? 'Paid actions are locked until we can confirm your subscription.'}
            </Text>

            <View style={styles.actions}>
              <Pressable style={styles.primaryButton} onPress={onRetry}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>Not now</Text>
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetContainer: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  sheet: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Shadows.md,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: Typography.sizes.sm * 1.4,
    marginBottom: Spacing.lg,
  },
  actions: {
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
});

export default VerifyConnectionSheet;
