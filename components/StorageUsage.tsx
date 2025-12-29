/**
 * StorageUsage - Display user's storage usage
 *
 * Shows a progress bar with used/total storage.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { StorageInfo } from '@/lib/database.types';

interface StorageUsageProps {
  /** Storage info object */
  storage: StorageInfo;
  /** Show label */
  showLabel?: boolean;
  /** Compact mode (smaller) */
  compact?: boolean;
}

export function StorageUsage({
  storage,
  showLabel = true,
  compact = false,
}: StorageUsageProps) {
  const isWarning = storage.percentage >= 80;
  const isCritical = storage.percentage >= 95;
  
  const barColor = isCritical
    ? Colors.error
    : isWarning
      ? Colors.warning
      : Colors.accent;
  
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, compact && styles.labelCompact]}>
            Storage
          </Text>
          <Text style={[styles.usage, compact && styles.usageCompact]}>
            {storage.formatted.used} / {storage.formatted.limit}
          </Text>
        </View>
      )}
      
      <View style={[styles.barContainer, compact && styles.barContainerCompact]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${storage.percentage}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      
      {!compact && (
        <Text style={styles.percentage}>
          {storage.percentage}% used
          {isWarning && !isCritical && ' - Running low'}
          {isCritical && ' - Almost full'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  containerCompact: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  labelCompact: {
    fontSize: Typography.sizes.sm,
  },
  usage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },
  usageCompact: {
    fontSize: Typography.sizes.xs,
  },
  barContainer: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  barContainerCompact: {
    height: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
  percentage: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
});
