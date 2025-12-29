import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Toast } from '@/components';
import { RequireAuth } from '@/components/RequireAuth';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface ExcludedPhoto {
  id: string;
  uri: string;
  type: 'screenshot' | 'duplicate';
}

/**
 * Generate mock excluded photos
 */
function generateExcludedPhotos(
  screenshotCount: number,
  duplicateCount: number
): ExcludedPhoto[] {
  const photos: ExcludedPhoto[] = [];

  // Generate screenshots
  for (let i = 0; i < screenshotCount; i++) {
    photos.push({
      id: `screenshot-${i}`,
      uri: `https://picsum.photos/seed/screenshot${i}/400/800`,
      type: 'screenshot',
    });
  }

  // Generate duplicates
  for (let i = 0; i < duplicateCount; i++) {
    photos.push({
      id: `duplicate-${i}`,
      uri: `https://picsum.photos/seed/duplicate${i}/400/400`,
      type: 'duplicate',
    });
  }

  return photos;
}

interface CollapsibleSectionProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  React.useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, { duration: 200 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 90}deg` }],
  }));

  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Colors.textSecondary}
          />
        </Animated.View>
      </Pressable>
      {expanded && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={styles.sectionContent}
        >
          {children}
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Excluded Photos Screen
 *
 * Shows photos that were automatically filtered out (screenshots, duplicates)
 * Users can include photos back into their selection
 */
export default function ExcludedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    screenshots?: string;
    duplicates?: string;
  }>();

  const screenshotCount = parseInt(params.screenshots || '3', 10);
  const duplicateCount = parseInt(params.duplicates || '2', 10);

  // Generate excluded photos
  const [excludedPhotos, setExcludedPhotos] = useState<ExcludedPhoto[]>(() =>
    generateExcludedPhotos(screenshotCount, duplicateCount)
  );

  // Section expansion state (collapsed by default)
  const [screenshotsExpanded, setScreenshotsExpanded] = useState(false);
  const [duplicatesExpanded, setDuplicatesExpanded] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);

  // Filter photos by type
  const screenshots = excludedPhotos.filter((p) => p.type === 'screenshot');
  const duplicates = excludedPhotos.filter((p) => p.type === 'duplicate');

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleIncludePhoto = useCallback((id: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Remove from excluded list
    setExcludedPhotos((prev) => prev.filter((p) => p.id !== id));

    // Show toast
    setShowToast(true);
  }, []);

  const handleToastHide = useCallback(() => {
    setShowToast(false);
  }, []);

  return (
    <RequireAuth>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons
              name="chevron-back"
              size={24}
              color={Colors.textPrimary}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Excluded Photos</Text>
          <View style={styles.headerSpacer} />
        </Animated.View>

        {/* Info Banner */}
        <Animated.View
          entering={FadeIn.delay(100).duration(300)}
          style={styles.infoBanner}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={Colors.textSecondary}
          />
          <Text style={styles.infoBannerText}>
            These photos were automatically filtered out. Tap "Include" to add
            them back to your selection.
          </Text>
        </Animated.View>

        {/* Sections */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Screenshots Section */}
          <CollapsibleSection
            title="Screenshots"
            count={screenshots.length}
            expanded={screenshotsExpanded}
            onToggle={() => setScreenshotsExpanded((prev) => !prev)}
          >
            {screenshots.length > 0 ? (
              <View style={styles.photoGrid}>
                {screenshots.map((photo) => (
                  <Animated.View
                    key={photo.id}
                    exiting={FadeOut.duration(200)}
                    style={styles.photoItem}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                    <Pressable
                      onPress={() => handleIncludePhoto(photo.id)}
                      style={styles.includeButton}
                    >
                      <Ionicons
                        name="add-circle"
                        size={14}
                        color={Colors.textPrimary}
                      />
                      <Text style={styles.includeButtonText}>Include</Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                All screenshots have been included
              </Text>
            )}
          </CollapsibleSection>

          {/* Duplicates Section */}
          <CollapsibleSection
            title="Duplicates"
            count={duplicates.length}
            expanded={duplicatesExpanded}
            onToggle={() => setDuplicatesExpanded((prev) => !prev)}
          >
            {duplicates.length > 0 ? (
              <View style={styles.photoGrid}>
                {duplicates.map((photo) => (
                  <Animated.View
                    key={photo.id}
                    exiting={FadeOut.duration(200)}
                    style={styles.photoItem}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                    <Pressable
                      onPress={() => handleIncludePhoto(photo.id)}
                      style={styles.includeButton}
                    >
                      <Ionicons
                        name="add-circle"
                        size={14}
                        color={Colors.textPrimary}
                      />
                      <Text style={styles.includeButtonText}>Include</Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                All duplicates have been included
              </Text>
            )}
          </CollapsibleSection>
        </ScrollView>

        {/* Success Toast */}
        <Toast
          visible={showToast}
          message="Photo included in selection"
          duration={1500}
          onHide={handleToastHide}
        />
      </SafeAreaView>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoBannerText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: Colors.glassBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countBadgeText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  sectionContent: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.md,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.glassBorder,
  },
  includeButton: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: Spacing.xs,
    right: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  includeButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
