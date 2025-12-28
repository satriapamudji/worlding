import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';

export interface SettingsRowProps {
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

/**
 * SettingsRow - Individual settings item with icon, label, and chevron
 *
 * Features:
 * - Optional leading icon
 * - Optional value text (right side)
 * - Chevron indicator for navigation
 * - Destructive variant (red text)
 * - Disabled state
 */
export function SettingsRow({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
  destructive = false,
  disabled = false,
}: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <View style={styles.leftContent}>
        {icon && (
          <View style={[styles.iconContainer, destructive && styles.iconDestructive]}>
            <FontAwesome
              name={icon}
              size={16}
              color={destructive ? Colors.error : Colors.textSecondary}
            />
          </View>
        )}
        <Text
          style={[
            styles.label,
            destructive && styles.labelDestructive,
            disabled && styles.labelDisabled,
          ]}
        >
          {label}
        </Text>
      </View>

      <View style={styles.rightContent}>
        {value && (
          <Text style={styles.value}>{value}</Text>
        )}
        {showChevron && onPress && (
          <FontAwesome
            name="chevron-right"
            size={12}
            color={Colors.textMuted}
            style={styles.chevron}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  pressed: {
    backgroundColor: Colors.glass,
  },
  disabled: {
    opacity: 0.5,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  iconDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '400',
  },
  labelDestructive: {
    color: Colors.error,
  },
  labelDisabled: {
    color: Colors.textMuted,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginRight: Spacing.sm,
  },
  chevron: {
    marginLeft: Spacing.xs,
  },
});

export default SettingsRow;
