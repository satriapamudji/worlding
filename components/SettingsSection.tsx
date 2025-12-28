import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface SettingsSectionProps {
  title?: string;
  children: React.ReactNode;
  footer?: string;
}

/**
 * SettingsSection - Groups settings rows with optional header and footer
 *
 * Features:
 * - Optional section title (uppercase, muted)
 * - Glassmorphic card container
 * - Dividers between children
 * - Optional footer text for explanations
 */
export function SettingsSection({ title, children, footer }: SettingsSectionProps) {
  const childArray = React.Children.toArray(children);

  return (
    <View style={styles.container}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}

      <View style={styles.card}>
        {childArray.map((child, index) => (
          <React.Fragment key={index}>
            {child}
            {index < childArray.length - 1 && (
              <View style={styles.divider} />
            )}
          </React.Fragment>
        ))}
      </View>

      {footer && (
        <Text style={styles.footer}>{footer}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 32 + Spacing.md, // Align with text after icon
  },
  footer: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.sm,
    marginLeft: Spacing.sm,
    lineHeight: Typography.sizes.xs * 1.5,
  },
});

export default SettingsSection;
