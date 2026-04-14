/**
 * SkeletonGrid Component
 *
 * Viewport-based skeleton loading grid for the Review screen.
 * Shows placeholder cells while photos are loading.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, Text, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout, Typography } from '@/constants/theme';

interface SkeletonGridProps {
  /** Number of skeleton items to show (if not specified, calculates based on viewport) */
  count?: number;
  /** Number of columns in the grid */
  columns?: number;
  /** Gap between items */
  gap?: number;
  /** Optional loading text to display as overlay */
  loadingText?: string;
}

/**
 * Calculate how many skeleton items to show based on viewport
 */
export function calculateSkeletonCount(
  columns: number = Layout.photoGridColumns,
  gap: number = Layout.photoGridGap
): number {
  const { width, height } = Dimensions.get('window');
  const headerHeight = 120; // Approximate header + filter chips height
  const bottomBarHeight = 100; // Approximate bottom bar height
  const availableHeight = height - headerHeight - bottomBarHeight;

  const itemWidth = (width - Spacing.md * 2 - gap * (columns - 1)) / columns;
  const rowHeight = itemWidth + gap;

  const visibleRows = Math.ceil(availableHeight / rowHeight);
  return visibleRows * columns;
}

export function SkeletonGrid({
  count,
  columns = Layout.photoGridColumns,
  gap = Layout.photoGridGap,
  loadingText,
}: SkeletonGridProps) {
  const skeletonCount = count ?? calculateSkeletonCount(columns, gap);

  const { width } = Dimensions.get('window');
  const itemWidth = (width - Spacing.md * 2 - gap * (columns - 1)) / columns;

  const items = useMemo(
    () => Array.from({ length: skeletonCount }, (_, i) => i),
    [skeletonCount]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.grid, { gap }]}>
        {items.map((index) => (
          <SkeletonItem key={index} size={itemWidth} delay={index * 50} />
        ))}
      </View>

      {/* Loading text overlay */}
      {loadingText && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={Colors.accent} style={styles.spinner} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      )}
    </View>
  );
}

interface SkeletonItemProps {
  size: number;
  delay?: number;
}

function SkeletonItem({ size, delay = 0 }: SkeletonItemProps) {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        true
      );
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeletonItem,
        { width: size, height: size },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skeletonItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 5, 5, 0.7)',
  },
  spinner: {
    marginBottom: Spacing.sm,
  },
  loadingText: {
    fontSize: Typography.sizes.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
