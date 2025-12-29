/**
 * HiddenPhotosSection
 *
 * A collapsible section that shows photos that were automatically hidden
 * (screenshots, downloads). Users can expand to view and include them.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import type { FilteredPhoto, PhotoFilterStats } from '@/lib/photo-filter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = Spacing.md;
const COLUMN_COUNT = Layout.photoGridColumns;
const GAP = Layout.photoGridGap;
const ITEM_WIDTH =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

interface HiddenPhotosSectionProps {
  /** Hidden photos (screenshots + downloads) */
  photos: FilteredPhoto[];
  /** Stats for display */
  stats: PhotoFilterStats;
  /** Currently selected photo IDs */
  selectedIds: string[];
  /** Callback when selection changes */
  onSelectionChange: (ids: string[]) => void;
  /** Callback to include all hidden photos */
  onIncludeAll: () => void;
}

/**
 * HiddenPhotosSection - Expandable section showing hidden photos
 *
 * Features:
 * - Collapsed by default showing count summary
 * - Expands to show photo grid with classification badges
 * - Tap any photo to include it in selection
 * - "Include All" button to select all hidden photos
 */
export function HiddenPhotosSection({
  photos,
  stats,
  selectedIds,
  onSelectionChange,
  onIncludeAll,
}: HiddenPhotosSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  const screenshotPhotos = photos.filter((p) => p.classification === 'screenshot');
  const downloadPhotos = photos.filter((p) => p.classification === 'downloaded');

  const totalHidden = photos.length;
  const selectedHiddenCount = photos.filter((p) =>
    selectedIds.includes(p.id)
  ).length;

  const handleToggleExpand = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpanded((prev) => !prev);
    rotation.value = withTiming(expanded ? 0 : 1, { duration: 200 });
  }, [expanded, rotation]);

  const handlePhotoPress = useCallback(
    (photoId: string) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const isSelected = selectedIds.includes(photoId);
      if (isSelected) {
        onSelectionChange(selectedIds.filter((id) => id !== photoId));
      } else {
        onSelectionChange([...selectedIds, photoId]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const handleIncludeAll = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onIncludeAll();
  }, [onIncludeAll]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 90}deg` }],
  }));

  // Build summary text
  const summaryParts: string[] = [];
  if (stats.screenshots > 0) {
    summaryParts.push(`${stats.screenshots} screenshot${stats.screenshots !== 1 ? 's' : ''}`);
  }
  if (stats.downloads > 0) {
    summaryParts.push(`${stats.downloads} download${stats.downloads !== 1 ? 's' : ''}`);
  }
  const summaryText = summaryParts.join(' • ');

  if (totalHidden === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header - always visible */}
      <Pressable onPress={handleToggleExpand} style={styles.header}>
        <View style={styles.headerLeft}>
          <Animated.View style={chevronStyle}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={Colors.textSecondary}
            />
          </Animated.View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>
              Hidden ({totalHidden})
              {selectedHiddenCount > 0 && (
                <Text style={styles.selectedCount}>
                  {' '}
                  • {selectedHiddenCount} selected
                </Text>
              )}
            </Text>
            <Text style={styles.headerSubtitle}>{summaryText}</Text>
          </View>
        </View>

        {expanded && (
          <Pressable onPress={handleIncludeAll} style={styles.includeAllButton}>
            <Text style={styles.includeAllText}>Include All</Text>
          </Pressable>
        )}
      </Pressable>

      {/* Expanded content */}
      {expanded && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={styles.content}
        >
          {/* Screenshots section */}
          {screenshotPhotos.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={14}
                  color={Colors.textMuted}
                />
                <Text style={styles.sectionTitle}>
                  Screenshots ({screenshotPhotos.length})
                </Text>
              </View>
              <View style={styles.photoGrid}>
                {screenshotPhotos.map((photo) => (
                  <HiddenPhotoItem
                    key={photo.id}
                    photo={photo}
                    isSelected={selectedIds.includes(photo.id)}
                    onPress={() => handlePhotoPress(photo.id)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Downloads section */}
          {downloadPhotos.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="download-outline"
                  size={14}
                  color={Colors.textMuted}
                />
                <Text style={styles.sectionTitle}>
                  Downloads ({downloadPhotos.length})
                </Text>
              </View>
              <View style={styles.photoGrid}>
                {downloadPhotos.map((photo) => (
                  <HiddenPhotoItem
                    key={photo.id}
                    photo={photo}
                    isSelected={selectedIds.includes(photo.id)}
                    onPress={() => handlePhotoPress(photo.id)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Help text */}
          <Text style={styles.helpText}>
            Tap any photo to include it in your selection
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// ============================================================================
// HIDDEN PHOTO ITEM
// ============================================================================

interface HiddenPhotoItemProps {
  photo: FilteredPhoto;
  isSelected: boolean;
  onPress: () => void;
}

function HiddenPhotoItem({ photo, isSelected, onPress }: HiddenPhotoItemProps) {
  const itemHeight = ITEM_WIDTH;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.photoItem, { height: itemHeight }]}
    >
      <Image
        source={{ uri: photo.uri }}
        style={styles.photo}
        resizeMode="cover"
      />

      {/* Overlay when not selected */}
      {!isSelected && <View style={styles.deselectedOverlay} />}

      {/* Selection indicator */}
      {isSelected ? (
        <LinearGradient
          colors={[Colors.accent, Colors.accentDark]}
          style={styles.checkmark}
        >
          <Ionicons name="checkmark" size={14} color={Colors.textPrimary} />
        </LinearGradient>
      ) : (
        <View style={styles.addButton}>
          <Ionicons name="add" size={16} color={Colors.textPrimary} />
        </View>
      )}

      {/* Classification badge */}
      <View style={styles.classificationBadge}>
        <Ionicons
          name={
            photo.classification === 'screenshot'
              ? 'phone-portrait-outline'
              : 'download-outline'
          }
          size={10}
          color={Colors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  selectedCount: {
    color: Colors.accent,
    fontWeight: '500',
  },
  headerSubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  includeAllButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.glass,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  includeAllText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  photoItem: {
    width: ITEM_WIDTH,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  deselectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  checkmark: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  classificationBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: Spacing.xs,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});

export default HiddenPhotosSection;
