import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState, useCallback } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { PhotoGrid, Toast } from '@/components';
import { RequireAuth } from '@/components/RequireAuth';
import { generateSyncPhotos } from '@/constants/mockData';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

/**
 * Review Screen - "Magic" Sync
 * 
 * "We found 34 memories from last weekend"
 * One-tap approval before photos leave the phone
 */
export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    worldName?: string;
    startDate?: string;
    endDate?: string;
    coverUri?: string;
  }>();

  // Generate mock photos that would be "found" from the date range
  const photos = useMemo(() => generateSyncPhotos(34), []);

  // All photos start as selected
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    photos.map(p => p.id)
  );

  // Toast state
  const [showToast, setShowToast] = useState(false);

  // Hidden items (screenshots, duplicates - simulated)
  const hiddenCount = {
    screenshots: 3,
    duplicates: 2,
  };

  const handleSelectionChange = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const handleAddPhotos = useCallback(() => {
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Show success toast
    setShowToast(true);
  }, []);

  const handleToastHide = useCallback(() => {
    setShowToast(false);
    // Navigate to invite screen after adding photos
    router.replace({
      pathname: '/invite',
      params: {
        worldId: 'world-new',
        worldName: params.worldName,
      },
    });
  }, [router, params.worldName]);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  return (
    <RequireAuth>
      <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            Found {photos.length} memories
          </Text>
          <Text style={styles.headerSubtitle}>
            from {params.worldName || 'last weekend'}
          </Text>
        </View>

        <Pressable
          style={styles.selectAllButton}
          onPress={() => setSelectedIds(photos.map(p => p.id))}
        >
          <Text style={styles.selectAllText}>Select All</Text>
        </Pressable>
      </Animated.View>

      {/* Scanning Complete Banner */}
      <Animated.View 
        entering={FadeInUp.delay(200).duration(400)} 
        style={styles.scanComplete}
      >
        <LinearGradient
          colors={['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scanCompleteGradient}
        >
          <Text style={styles.scanIcon}>✨</Text>
          <Text style={styles.scanText}>Smart filter applied • Ready to add</Text>
        </LinearGradient>
      </Animated.View>

      {/* Photo Grid */}
      <View style={styles.gridContainer}>
        <PhotoGrid
          photos={photos}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          showOwnerAvatar={false}
        />
      </View>

      {/* Hidden Items Counter */}
      <Animated.View 
        entering={FadeIn.delay(400).duration(300)}
        style={styles.hiddenCounter}
      >
        <Text style={styles.hiddenText}>
          🚫 Hidden: {hiddenCount.screenshots} screenshots, {hiddenCount.duplicates} duplicates
        </Text>
      </Animated.View>

      {/* Floating Add Button */}
      <Animated.View 
        entering={FadeIn.delay(500).duration(400)}
        style={styles.floatingButtonContainer}
      >
        <View style={styles.privacyBadge}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            Only selected photos are uploaded
          </Text>
        </View>
        
        <Pressable onPress={handleAddPhotos} style={styles.addButtonPressable}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>
              Add {selectedIds.length} Photos to World
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Success Toast */}
      <Toast
        visible={showToast}
        message={`${params.worldName || 'World'} created with ${selectedIds.length} photos`}
        duration={2000}
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeIcon: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },
  selectAllButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  selectAllText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  scanComplete: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  scanCompleteGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  scanIcon: {
    fontSize: 16,
  },
  scanText: {
    color: Colors.success,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  gridContainer: {
    flex: 1,
  },
  hiddenCounter: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  hiddenText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  floatingButtonContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    opacity: 0.7,
  },
  privacyIcon: {
    fontSize: 14,
  },
  privacyText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
  },
  addButtonPressable: {
    ...Shadows.glowSubtle,
  },
  addButton: {
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: 'bold',
  },
});
