import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from './BottomSheet';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface SignOutSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail?: string;
}

/**
 * SignOutSheet - Confirmation dialog for signing out
 *
 * Features:
 * - Shows current user email
 * - Destructive action styling
 * - Cancel and confirm buttons
 * - Animated bottom sheet
 */
export function SignOutSheet({
  visible,
  onClose,
  onConfirm,
  userEmail,
}: SignOutSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <Text style={styles.title}>Sign Out</Text>
        <Text style={styles.description}>
          Are you sure you want to sign out
          {userEmail ? ` of ${userEmail}` : ''}?
        </Text>

        <View style={styles.buttons}>
          {/* Cancel Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.cancelButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          {/* Sign Out Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={onConfirm}
          >
            <LinearGradient
              colors={[Colors.error, '#DC2626']}
              style={styles.signOutGradient}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: Typography.sizes.md * 1.5,
  },
  buttons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  cancelButton: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  signOutGradient: {
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
});

export default SignOutSheet;
