/**
 * ReviewHeader Component
 *
 * Informative header for the Review screen showing date range and photo count.
 * Apple Photos-inspired design with dark theme.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';

interface ReviewHeaderProps {
  /** Date range string (e.g., "Dec 20-28") */
  dateRange: string;
  /** Total photo count */
  photoCount: number;
  /** Handler for close button */
  onClose: () => void;
}

export function ReviewHeader({
  dateRange,
  photoCount,
  onClose,
}: ReviewHeaderProps) {
  const photoText = photoCount === 1 ? '1 photo' : `${photoCount} photos`;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <Text style={styles.dateInfo}>
          {dateRange} <Text style={styles.separator}>•</Text> {photoText}
        </Text>
      </View>

      {/* Spacer to balance the close button */}
      <View style={styles.spacer} />
    </View>
  );
}

/**
 * Format a date range for display
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Formatted date range (e.g., "Dec 20-28" or "Dec 20 - Jan 3")
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const dayFormatter = new Intl.DateTimeFormat('en-US', { day: 'numeric' });

  const startMonth = monthFormatter.format(start);
  const startDay = dayFormatter.format(start);
  const endMonth = monthFormatter.format(end);
  const endDay = dayFormatter.format(end);

  if (start.getMonth() === end.getMonth()) {
    // Same month: "Dec 20-28"
    return `${startMonth} ${startDay}-${endDay}`;
  } else {
    // Different months: "Dec 20 - Jan 3"
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.glass,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInfo: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
  },
  separator: {
    color: Colors.textMuted,
    marginHorizontal: Spacing.xs,
  },
  spacer: {
    width: 40,
    height: 40,
  },
});
