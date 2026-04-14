/**
 * BurstGroupItem Component
 *
 * Displays a burst photo group with badge showing count.
 * Supports inline expansion to show all photos in the burst.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import type { FilteredPhoto, BurstGroup } from '@/lib/photo-filter';

interface BurstGroupItemProps {
  /** The burst group to display */
  burstGroup: BurstGroup;
  /** Whether this burst is currently expanded */
  isExpanded: boolean;
  /** Set of selected photo IDs */
  selectedIds: Set<string>;
  /** Handler to toggle expansion */
  onToggleExpand: () => void;
  /** Handler when a photo is tapped for selection */
  onPhotoSelect: (photoId: string) => void;
  /** Size of each photo in the grid */
  photoSize: number;
}

export function BurstGroupItem({
  burstGroup,
  isExpanded,
  selectedIds,
  onToggleExpand,
  onPhotoSelect,
  photoSize,
}: BurstGroupItemProps) {
  const representativePhoto = burstGroup.photos.find(
    (p) => p.id === burstGroup.representativePhotoId
  );

  if (!representativePhoto) {
    return null;
  }

  const animatedBadgeStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotate: withTiming(isExpanded ? '180deg' : '0deg', { duration: 200 }),
        },
      ],
    };
  });

  // Collapsed view - just show representative with badge
  if (!isExpanded) {
    return (
      <TouchableOpacity
        style={[styles.container, { width: photoSize, height: photoSize }]}
        onPress={onToggleExpand}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: representativePhoto.localUri || representativePhoto.uri }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Burst badge */}
        <View style={styles.burstBadge}>
          <Ionicons name="layers" size={12} color={Colors.textPrimary} />
          <Text style={styles.burstCount}>{burstGroup.count}</Text>
        </View>

        {/* Selection indicator */}
        {selectedIds.has(representativePhoto.id) && (
          <View style={styles.selectedOverlay}>
            <View style={styles.checkmark}>
              <Ionicons name="checkmark" size={14} color={Colors.textPrimary} />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Expanded view - show all photos with collapse option
  return (
    <View style={styles.expandedContainer}>
      {/* Collapse header */}
      <TouchableOpacity style={styles.collapseHeader} onPress={onToggleExpand}>
        <Ionicons name="layers" size={14} color={Colors.accent} />
        <Text style={styles.collapseText}>
          {burstGroup.count} burst photos
        </Text>
        <Animated.View style={animatedBadgeStyle}>
          <Ionicons name="chevron-up" size={16} color={Colors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>

      {/* All burst photos */}
      <View style={styles.photosGrid}>
        {burstGroup.photos.map((photo) => {
          const isSelected = selectedIds.has(photo.id);
          const isRepresentative = photo.id === burstGroup.representativePhotoId;

          return (
            <Pressable
              key={photo.id}
              style={[styles.photoWrapper, { width: photoSize, height: photoSize }]}
              onPress={() => onPhotoSelect(photo.id)}
            >
              <Image
                source={{ uri: photo.localUri || photo.uri }}
                style={styles.image}
                resizeMode="cover"
              />

              {/* Representative indicator */}
              {isRepresentative && (
                <View style={styles.representativeBadge}>
                  <Ionicons name="star" size={10} color={Colors.accent} />
                </View>
              )}

              {/* Selection checkmark (Apple Photos style, bottom-right) */}
              <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={14} color={Colors.textPrimary} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  burstBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    gap: 4,
  },
  burstCount: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  checkmark: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  collapseText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.xs,
    gap: Spacing.xs,
  },
  photoWrapper: {
    position: 'relative',
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  representativeBadge: {
    position: 'absolute',
    top: Spacing.xs,
    left: Spacing.xs,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircle: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.textPrimary,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircleActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
});
