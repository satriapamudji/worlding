/**
 * FilterChips Component
 *
 * Horizontal scrollable filter chips for the Review screen.
 * Supports Recommended, Hidden, and Videos filters.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';

export interface FilterChip {
  id: string;
  label: string;
  count: number;
}

interface FilterChipsProps {
  /** Array of filter chips to display */
  chips: FilterChip[];
  /** ID of the currently active chip */
  activeChipId: string;
  /** Handler for chip selection */
  onChipPress: (chipId: string) => void;
}

export function FilterChips({
  chips,
  activeChipId,
  onChipPress,
}: FilterChipsProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {chips.map((chip) => {
          const isActive = chip.id === activeChipId;
          return (
            <TouchableOpacity
              key={chip.id}
              onPress={() => onChipPress(chip.id)}
              activeOpacity={0.7}
            >
              <BlurView
                intensity={isActive ? 20 : 10}
                tint="dark"
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {chip.label}
                </Text>
                <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                  <Text style={[styles.countText, isActive && styles.countTextActive]}>
                    {chip.count}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Create filter chips from photo stats
 */
export function createFilterChips(
  recommendedCount: number,
  hiddenCount: number,
  videosCount: number
): FilterChip[] {
  return [
    { id: 'recommended', label: 'Recommended', count: recommendedCount },
    { id: 'hidden', label: 'Hidden', count: hiddenCount },
    { id: 'videos', label: 'Videos', count: videosCount },
  ];
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glass,
    overflow: 'hidden',
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  chipLabelActive: {
    color: Colors.textPrimary,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.glassLight,
    paddingHorizontal: Spacing.xs,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  countText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  countTextActive: {
    color: Colors.textPrimary,
  },
});
