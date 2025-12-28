/**
 * Media Viewer Screen
 * 
 * Full-screen gallery viewer for photos and videos with:
 * - Horizontal swipe navigation
 * - Pinch-to-zoom and pan
 * - Auto-play videos
 * - Actions menu (share, save, delete)
 */

import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, MediaActions, MediaViewer } from '@/components';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { CURRENT_USER, getWorldById } from '@/constants/mockData';
import type { Photo } from '@/constants/mockData';
import { formatMediaDate } from '@/lib/media-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MediaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { worldId, mediaId, initialIndex } = useLocalSearchParams<{
    worldId: string;
    mediaId: string;
    initialIndex?: string;
  }>();

  // Get world data
  const world = getWorldById(worldId);
  const photos = world?.photos ?? [];
  
  // State
  const [currentIndex, setCurrentIndex] = useState(
    initialIndex ? parseInt(initialIndex, 10) : 0
  );
  const [isZoomed, setIsZoomed] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [mediaList, setMediaList] = useState(photos);

  // Refs
  const flatListRef = useRef<FlatList>(null);

  // Current media
  const currentMedia = mediaList[currentIndex];

  // Is current user the owner?
  const isOwner = currentMedia?.owner.id === CURRENT_USER.id;

  // Haptic feedback
  const triggerHaptic = useCallback((style = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    triggerHaptic();
    router.back();
  }, [router, triggerHaptic]);

  // Handle actions
  const handleActionsPress = useCallback(() => {
    triggerHaptic();
    setShowActions(true);
  }, [triggerHaptic]);

  const handleActionsClose = useCallback(() => {
    setShowActions(false);
  }, []);

  // Handle delete
  const handleDelete = useCallback(() => {
    // Remove from list
    const newList = mediaList.filter((_, index) => index !== currentIndex);
    
    if (newList.length === 0) {
      // No more media, go back
      router.back();
      return;
    }

    // Adjust index if needed
    const newIndex = currentIndex >= newList.length ? newList.length - 1 : currentIndex;
    setMediaList(newList);
    setCurrentIndex(newIndex);
  }, [mediaList, currentIndex, router]);

  // Handle scroll end
  const handleScrollEnd = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < mediaList.length) {
      setCurrentIndex(newIndex);
      triggerHaptic();
    }
  }, [currentIndex, mediaList.length, triggerHaptic]);

  // Viewability config for FlatList
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  // Get layout for FlatList
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  // Render media item
  const renderItem = useCallback(({ item, index }: { item: Photo; index: number }) => (
    <MediaViewer
      media={item}
      isActive={index === currentIndex}
      onZoomChange={setIsZoomed}
    />
  ), [currentIndex]);

  if (!world || mediaList.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Media not found</Text>
        <Pressable onPress={handleClose}>
          <Text style={styles.errorLink}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <View style={styles.backdrop} />

      {/* Main content */}
      <View style={styles.content}>
        {/* Header - Always visible */}
        <View style={[styles.header, { top: insets.top + Spacing.md }]}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <View style={styles.closeIcon}>
              <View style={styles.closeLine1} />
              <View style={styles.closeLine2} />
            </View>
          </Pressable>

          <Text style={styles.counter}>
            {currentIndex + 1} of {mediaList.length}
          </Text>

          <Pressable onPress={handleActionsPress} style={styles.moreButton}>
            <View style={styles.moreIcon}>
              <View style={styles.moreDot} />
              <View style={styles.moreDot} />
              <View style={styles.moreDot} />
            </View>
          </Pressable>
        </View>

        {/* Media gallery */}
        <FlatList
          ref={flatListRef}
          data={mediaList}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={currentIndex}
          getItemLayout={getItemLayout}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEnabled={!isZoomed}
          bounces={false}
          decelerationRate="fast"
        />

        {/* Footer - Always visible */}
        {currentMedia && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.ownerInfo}>
              <Avatar
                uri={currentMedia.owner.avatar}
                name={currentMedia.owner.name}
                size="medium"
              />
              <View style={styles.ownerText}>
                <Text style={styles.ownerName}>{currentMedia.owner.name}</Text>
                <Text style={styles.timestamp}>
                  {formatMediaDate(currentMedia.timestamp)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Actions sheet */}
      <MediaActions
        media={currentMedia}
        isOwner={isOwner}
        isOpen={showActions}
        onClose={handleActionsClose}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeLine1: {
    position: 'absolute',
    width: 18,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  closeLine2: {
    position: 'absolute',
    width: 18,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  counter: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  moreButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreIcon: {
    flexDirection: 'column',
    gap: 3,
  },
  moreDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textPrimary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ownerText: {
    flex: 1,
  },
  ownerName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  timestamp: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
  },
  errorLink: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
  },
});
