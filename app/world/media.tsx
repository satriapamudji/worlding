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
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import type { MediaWithOwner } from '@/lib/database.types';
import { formatMediaDate } from '@/lib/media-utils';
import { getWorldMedia, getMediaUrls } from '@/lib/api/media';
import { useAuth } from '@/hooks/useAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MediaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { worldId, mediaId, initialIndex } = useLocalSearchParams<{
    worldId: string;
    mediaId: string;
    initialIndex?: string;
  }>();

  // State
  const [mediaList, setMediaList] = useState<MediaWithOwner[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(
    initialIndex ? parseInt(initialIndex, 10) : 0
  );
  const [isZoomed, setIsZoomed] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Refs
  const flatListRef = useRef<FlatList>(null);

  // Fetch media on mount
  useEffect(() => {
    async function fetchMedia() {
      if (!worldId) {
        setError('No world ID provided');
        setLoading(false);
        return;
      }

      const result = await getWorldMedia(worldId);
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.data.length === 0) {
        setError('No media found');
        setLoading(false);
        return;
      }

      setMediaList(result.data);

      // Get signed URLs for all media
      const storagePaths = result.data.map(m => m.storage_path);
      const urlsResult = await getMediaUrls(storagePaths);
      
      if (urlsResult.data) {
        setMediaUrls(urlsResult.data);
      }

      // Find initial index based on mediaId if provided
      if (mediaId) {
        const idx = result.data.findIndex(m => m.id === mediaId);
        if (idx >= 0) {
          setCurrentIndex(idx);
        }
      }

      setLoading(false);
    }

    fetchMedia();
  }, [worldId, mediaId]);

  // Current media
  const currentMedia = mediaList[currentIndex];
  const currentMediaUrl = currentMedia ? mediaUrls[currentMedia.storage_path] : undefined;

  // Is current user the owner?
  const isOwner = user && currentMedia?.owner_id === user.id;

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
  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  // Render media item
  const renderItem = useCallback(({ item, index }: { item: MediaWithOwner; index: number }) => {
    const url = mediaUrls[item.storage_path];
    if (!url) {
      return (
        <View style={styles.loadingItem}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      );
    }
    return (
      <MediaViewer
        media={item}
        uri={url}
        isActive={index === currentIndex}
        onZoomChange={setIsZoomed}
      />
    );
  }, [currentIndex, mediaUrls]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // Error or empty state
  if (error || mediaList.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'No media found'}</Text>
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
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>

          <Text style={styles.counter}>
            {currentIndex + 1} of {mediaList.length}
          </Text>

          <Pressable onPress={handleActionsPress} style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={20} color={Colors.textPrimary} />
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
                uri={currentMedia.owner.avatar_url ?? undefined}
                name={currentMedia.owner.name}
                size="medium"
              />
              <View style={styles.ownerText}>
                <Text style={styles.ownerName}>{currentMedia.owner.name}</Text>
                <Text style={styles.timestamp}>
                  {formatMediaDate(new Date(currentMedia.taken_at ?? currentMedia.created_at))}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Actions sheet */}
      {currentMedia && currentMediaUrl && (
        <MediaActions
          media={currentMedia}
          uri={currentMediaUrl}
          isOwner={!!isOwner}
          isOpen={showActions}
          onClose={handleActionsClose}
          onDelete={handleDelete}
        />
      )}
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
  loadingItem: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
