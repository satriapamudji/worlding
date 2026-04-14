/**
 * SelectionPromptSheet Component
 *
 * Glassmorphic bottom sheet prompt for when there are 50+ photos.
 * Asks user whether to select all or pick manually.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, Spacing, Typography, Radius, Shadows } from '@/constants/theme';

interface SelectionPromptSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Total photo count */
  photoCount: number;
  /** Handler when user selects "Select All" */
  onSelectAll: () => void;
  /** Handler when user selects "Pick Manually" */
  onSelectManually: () => void;
}

export function SelectionPromptSheet({
  visible,
  photoCount,
  onSelectAll,
  onSelectManually,
}: SelectionPromptSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(300);

  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    } else {
      translateY.value = withTiming(300, { duration: 200 });
    }
  }, [visible, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.overlay} onPress={onSelectManually}>
        <Animated.View
          style={[
            styles.sheetContainer,
            animatedStyle,
            { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="images" size={40} color={Colors.accent} />
            </View>

            {/* Title */}
            <Text style={styles.title}>Found {photoCount} photos</Text>

            {/* Subtitle - informational tone */}
            <Text style={styles.subtitle}>
              Would you like to select all or pick manually?
            </Text>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onSelectAll}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={20} color={Colors.textPrimary} />
                <Text style={styles.primaryButtonText}>Select All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onSelectManually}
                activeOpacity={0.8}
              >
                <Ionicons name="hand-left" size={18} color={Colors.textSecondary} />
                <Text style={styles.secondaryButtonText}>Pick Manually</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
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
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  actions: {
    gap: Spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    ...Shadows.glowSubtle,
  },
  primaryButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: Spacing.sm,
  },
  secondaryButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
