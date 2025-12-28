import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';

interface SettingsToggleProps {
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * SettingsToggle - Toggle switch for settings
 *
 * Features:
 * - Optional leading icon
 * - Label and optional description
 * - iOS-style switch
 * - Disabled state
 */
export function SettingsToggle({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: SettingsToggleProps) {
  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.leftContent}>
        {icon && (
          <View style={styles.iconContainer}>
            <FontAwesome name={icon} size={16} color={Colors.textSecondary} />
          </View>
        )}
        <View style={styles.textContent}>
          <Text style={[styles.label, disabled && styles.labelDisabled]}>
            {label}
          </Text>
          {description && (
            <Text style={styles.description}>{description}</Text>
          )}
        </View>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: Colors.border,
          true: Colors.accent,
        }}
        thumbColor={Colors.textPrimary}
        ios_backgroundColor={Colors.border}
      />
    </View>
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
  disabled: {
    opacity: 0.5,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
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
  textContent: {
    flex: 1,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '400',
  },
  labelDisabled: {
    color: Colors.textMuted,
  },
  description: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
    lineHeight: Typography.sizes.xs * 1.4,
  },
});

export default SettingsToggle;
