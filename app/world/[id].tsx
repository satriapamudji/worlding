import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  Image,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  useAnimatedScrollHandler,
  Extrapolation,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Avatar, AvatarStack, ArchiveCelebration } from '@/components';
import { RequireAuth } from '@/components/RequireAuth';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getWorld, getWorldMedia, archiveWorld } from '@/lib/api';
import { formatDateRange } from '@/lib/database.types';
import { logger } from '@/lib/logger';
import type { WorldWithDetails, MediaWithOwner, WorldMemberWithProfile, WorldState, SyncStatus } from '@/lib/database.types';
import { formatDuration } from '@/lib/media-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_MAX_HEIGHT = 380;
const HEADER_MIN_HEIGHT = 100;
const PHOTO_GAP = 2;
const PHOTO_COLUMNS = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - (PHOTO_GAP * (PHOTO_COLUMNS - 1))) / PHOTO_COLUMNS;
const TITLE_FONT_SIZE = Typography.sizes.xxl + 4;
const TITLE_LINE_HEIGHT = TITLE_FONT_SIZE * 1.1;
const NAV_BUTTON_SIZE = 40;
const NAV_BAR_PADDING = Spacing.sm;
const NAV_BAR_GAP = Spacing.md;
const WORLD_SHARE_BASE_URL = 'https://worlding.app/world';

type ShareMode = 'invite' | 'view';

const buildWorldShareUrl = (worldId: string, mode: ShareMode) => {
  return `${WORLD_SHARE_BASE_URL}/${worldId}?mode=${mode}`;
};

// Local types for UI rendering
interface DisplayMember {
  id: string;
  name: string;
  avatar: string | null;
  syncStatus: SyncStatus;
}

interface DisplayPhoto {
  id: string;
  uri: string;
  thumbnailUri?: string;
  type: 'image' | 'video';
  duration?: number;
  timestamp: Date;
  owner: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

// Group photos by date
interface PhotoGroup {
  date: string;
  dateLabel: string;
  photos: DisplayPhoto[];
}

function groupPhotosByDate(photos: DisplayPhoto[]): PhotoGroup[] {
  const groups: Map<string, DisplayPhoto[]> = new Map();

  photos.forEach(photo => {
    const date = new Date(photo.timestamp);
    const dateKey = date.toISOString().split('T')[0];

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(photo);
  });

  const result: PhotoGroup[] = [];
  const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  sortedDates.forEach(dateKey => {
    let dateLabel: string;
    if (dateKey === today) {
      dateLabel = 'Today';
    } else if (dateKey === yesterday) {
      dateLabel = 'Yesterday';
    } else {
      const date = new Date(dateKey);
      dateLabel = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }

    result.push({
      date: dateKey,
      dateLabel,
      photos: groups.get(dateKey)!,
    });
  });

  return result;
}

// Create rows of photos for the grid
interface PhotoRow {
  type: 'photos';
  id: string;
  photos: DisplayPhoto[];
}

interface DateHeader {
  type: 'date';
  id: string;
  label: string;
  photoCount: number;
}

interface SyncStatusSection {
  type: 'sync-status';
  id: string;
  members: DisplayMember[];
}

interface WorldActionSection {
  type: 'world-action';
  id: string;
  action: 'complete' | 'relive';
}

type ListItem = PhotoRow | DateHeader | SyncStatusSection | WorldActionSection;

function createListData(
  photoGroups: PhotoGroup[],
  members: DisplayMember[],
  state: WorldState
): ListItem[] {
  const items: ListItem[] = [];

  if (state === 'archived') {
    items.push({
      type: 'world-action',
      id: 'world-action-relive',
      action: 'relive',
    });
  } else {
    items.push({
      type: 'world-action',
      id: 'world-action-complete',
      action: 'complete',
    });
  }

  // Add sync status section for non-archived Worlds
  if (state !== 'archived') {
    const pendingMembers = members.filter(m => m.syncStatus !== 'synced');
    if (pendingMembers.length > 0) {
      items.push({
        type: 'sync-status',
        id: 'sync-status',
        members: pendingMembers,
      });
    }
  }

  photoGroups.forEach(group => {
    items.push({
      type: 'date',
      id: `date-${group.date}`,
      label: group.dateLabel,
      photoCount: group.photos.length,
    });

    for (let i = 0; i < group.photos.length; i += PHOTO_COLUMNS) {
      items.push({
        type: 'photos',
        id: `row-${group.date}-${i}`,
        photos: group.photos.slice(i, i + PHOTO_COLUMNS),
      });
    }
  });

  return items;
}

// Transform Supabase data to display format
function transformMember(member: WorldMemberWithProfile): DisplayMember {
  return {
    id: member.id,
    name: member.profile.name,
    avatar: member.profile.avatar_url,
    syncStatus: member.sync_status,
  };
}

function transformMedia(media: MediaWithOwner, urlMap: Record<string, string>): DisplayPhoto {
  const signedUrl = urlMap[media.storage_path] || '';
  return {
    id: media.id,
    uri: signedUrl,
    thumbnailUri: media.thumbnail_path ? urlMap[media.thumbnail_path] : undefined,
    type: media.type,
    duration: media.duration ?? undefined,
    timestamp: new Date(media.taken_at || media.created_at),
    owner: {
      id: media.owner.id,
      name: media.owner.name,
      avatar: media.owner.avatar_url,
    },
  };
}

export default function WorldViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  // Data state
  const [world, setWorld] = useState<WorldWithDetails | null>(null);
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [members, setMembers] = useState<DisplayMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showCelebration, setShowCelebration] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isSyncStatusExpanded, setIsSyncStatusExpanded] = useState(true);
  const [headerTopHeight, setHeaderTopHeight] = useState(0);
  const [isArchiving, setIsArchiving] = useState(false);

  // Animation values
  const scrollY = useSharedValue(0);
  const backButtonScale = useSharedValue(1);
  const shareButtonScale = useSharedValue(1);
  const fabScale = useSharedValue(1);
  const reliveButtonScale = useSharedValue(1);
  const completeButtonScale = useSharedValue(1);

  // Fetch world data
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const loadWorldData = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!id) return;

    const showLoading = options?.showLoading ?? false;
    const isFirstLoad = !hasLoadedOnceRef.current;

    if (showLoading || isFirstLoad) {
      setLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }

    try {
      // Fetch world details
      const worldResult = await getWorld(id);
      if (worldResult.error || !worldResult.data) {
        if (hasLoadedOnceRef.current) {
          logger.world.warn('Failed to refresh world', { worldId: id, error: worldResult.error || 'World not found' });
          return;
        }

        setError(worldResult.error || 'World not found');
        setLoading(false);
        return;
      }

      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
      }

      setWorld(worldResult.data);
      
      // Transform members
      const displayMembers = worldResult.data.members.map(transformMember);
      setMembers(displayMembers);

      // Fetch media with signed URLs
      const mediaResult = await getWorldMedia(id);
      if (mediaResult.error) {
        logger.media.warn('Failed to load media', { worldId: id, error: mediaResult.error });
        setPhotos([]);
      } else if (mediaResult.data.length > 0) {
        // Get signed URLs for all media
        const { getMediaUrls } = await import('@/lib/api');
        const storagePaths = mediaResult.data.map(m => m.storage_path);
        const thumbnailPaths = mediaResult.data
          .filter(m => m.thumbnail_path)
          .map(m => m.thumbnail_path!);
        
        const urlResult = await getMediaUrls([...storagePaths, ...thumbnailPaths]);
        const urlMap = urlResult.data || {};

        // Transform media to display format
        const displayPhotos = mediaResult.data.map(m => transformMedia(m, urlMap));
        setPhotos(displayPhotos);
      } else {
        setPhotos([]);
      }
    } catch (e) {
      logger.world.error('Error loading world', { worldId: id, error: e });
      if (!hasLoadedOnceRef.current) {
        setError('Failed to load world');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadWorldData({ showLoading: !hasLoadedOnceRef.current });
    }, [loadWorldData])
  );

  // Prepare list data
  const listData = useMemo(() => {
    if (!world) return [];
    const groups = groupPhotosByDate(photos);
    return createListData(groups, members, world.state);
  }, [world, photos, members]);

  // Derived values
  const dateRange = world ? formatDateRange(world.start_date, world.end_date) : '';
  const coverUrl = world?.cover_url || 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=800';
  const coverSource = useMemo(() => ({ uri: coverUrl }), [coverUrl]);
  const isArchived = world?.state === 'archived';
  const pendingMembers = members.filter(m => m.syncStatus !== 'synced');

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Animated styles
  const headerStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
      [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
      Extrapolation.CLAMP
    );
    return { height };
  });

  const headerContentOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, 120],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  const stickyTitleOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [100, 160],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  // Button animations
  const createPressHandlers = (scale: SharedValue<number>) => ({
    onPressIn: () => {
      scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
    },
    onPressOut: () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    },
  });

  const backButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backButtonScale.value }],
  }));

  const shareButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shareButtonScale.value }],
  }));

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const reliveButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reliveButtonScale.value }],
  }));

  const completeButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: completeButtonScale.value }],
  }));

  const triggerHaptic = useCallback(
    (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(style);
      }
    },
    []
  );

  const worldTitle = world?.title ?? '';
  const headerContentTop = insets.top + NAV_BAR_PADDING + NAV_BUTTON_SIZE + NAV_BAR_PADDING + NAV_BAR_GAP;
  const headerBottomTop = headerContentTop + headerTopHeight + Spacing.md;

  const handleInvite = useCallback(() => {
    triggerHaptic();
    router.push({
      pathname: '/invite',
      params: {
        worldId: id,
        worldName: worldTitle,
      },
    });
  }, [id, router, triggerHaptic, worldTitle]);

  const headerElement = useMemo(
    () => (
      <Animated.View style={[styles.header, headerStyle]}>
        {/* Cover Image */}
        <Image
          source={coverSource}
          style={styles.coverImage}
          resizeMode="cover"
        />

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['rgba(5,5,5,0.3)', 'rgba(5,5,5,0)', 'rgba(5,5,5,0.85)', Colors.background]}
          locations={[0, 0.25, 0.7, 1]}
          style={styles.gradient}
        />

        {/* Header Top Content */}
        <Animated.View
          style={[styles.headerTopContent, headerContentOpacity, { top: headerContentTop }]}
          onLayout={(event) => {
            const nextHeight = Math.round(event.nativeEvent.layout.height);
            setHeaderTopHeight((prev) => (prev === nextHeight ? prev : nextHeight));
          }}
        >
          {/* Status Badge */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                isArchived ? styles.statusBadgeArchived : styles.statusBadgeActive,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  isArchived ? styles.statusDotArchived : styles.statusDotActive,
                ]}
              />
              <Text style={styles.statusText}>
                {isArchived ? 'Complete' : 'Live'}
              </Text>
            </View>

            <View style={styles.dateBadge}>
              <Text style={styles.dateText}>{dateRange}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {worldTitle}
          </Text>

          {/* Members Row */}
          <View style={styles.membersRow}>
            <AvatarStack
              users={members.map(m => ({ id: m.id, name: m.name, avatar: m.avatar ?? undefined }))}
              size="medium"
              maxDisplay={5}
            />
            {!isArchived && (
              <Pressable style={styles.inviteButton} onPress={handleInvite}>
                <Text style={styles.inviteButtonText}>+ Invite</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Header Bottom Content */}
        <Animated.View
          style={[
            styles.headerBottomContent,
            headerContentOpacity,
            { top: headerBottomTop },
          ]}
        >
          <View style={styles.statsRow}>
            <View style={styles.statsLeft}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{photos.length}</Text>
                <Text style={styles.statLabel}>photos</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{members.length}</Text>
                <Text style={styles.statLabel}>members</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    ),
    [
      coverSource,
      dateRange,
      handleInvite,
      headerBottomTop,
      headerContentOpacity,
      headerContentTop,
      headerStyle,
      isArchived,
      members,
      photos.length,
      worldTitle,
    ]
  );

  const refreshRowElement = isRefreshing ? (
    <View style={styles.refreshRow}>
      <ActivityIndicator size="small" color={Colors.textSecondary} />
      <Text style={styles.refreshText}>Refreshing…</Text>
    </View>
  ) : null;

  // NOTE: Pass a React element (not an inline component function) so FlatList
  // doesn't treat the header as a new component type on every render.
  const listHeaderComponent = useMemo(
    () => (
      <>
        {headerElement}
        {refreshRowElement}
      </>
    ),
    [headerElement, refreshRowElement]
  );

  // Loading state (only block the screen on the very first load)
  if (loading && !world) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading world...</Text>
      </View>
    );
  }

  // Error state (only block the screen if we have nothing to show)
  if ((error && !world) || !world) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>{error || 'World not found'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.errorLink}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleBack = () => {
    triggerHaptic();
    router.back();
  };

  const handleShare = async () => {
    triggerHaptic();
    const mode: ShareMode = isArchived ? 'view' : 'invite';
    const shareUrl = buildWorldShareUrl(world.id, mode);
    const message = isArchived
      ? `Relive "${world.title}" on Worlding.\n${shareUrl}`
      : `Join my World "${world.title}" on Worlding.\n${shareUrl}`;

    try {
      await Share.share({
        title: world.title,
        message,
        url: shareUrl,
      });
    } catch (error) {
      logger.world.warn('Share failed', error);
    }
  };

  const handleAddPhotos = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/review',
      params: {
        worldId: id,
        worldName: world.title,
        startDate: world.start_date,
        endDate: world.end_date,
        coverUri: coverUrl,
      },
    });
  };

  const handleRelive = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/world/relive?id=${id}`);
  };

  const handleArchive = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setShowArchiveConfirm(true);
  };

  const confirmArchive = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setShowArchiveConfirm(false);
    setIsArchiving(true);

    try {
      const result = await archiveWorld(id!);
      if (result.error) {
        logger.world.error('Failed to archive world', { worldId: id, error: result.error });
        // TODO: Show error toast
        return;
      }
      // Refresh world data to get updated state
      await loadWorldData();
      setShowCelebration(true);
    } catch (e) {
      logger.world.error('Error archiving world', { worldId: id, error: e });
    } finally {
      setIsArchiving(false);
    }
  };

  const cancelArchive = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setShowArchiveConfirm(false);
  };

  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
  };

  const handleCelebrationRelive = () => {
    setShowCelebration(false);
    router.push(`/world/relive?id=${id}`);
  };



  const handlePhotoPress = (photo: DisplayPhoto) => {
    triggerHaptic();
    // Find the index of this photo in the photos array
    const photoIndex = photos.findIndex(p => p.id === photo.id);
    router.push({
      pathname: '/world/media',
      params: {
        worldId: id,
        mediaId: photo.id,
        initialIndex: photoIndex >= 0 ? photoIndex.toString() : '0',
      },
    });
  };

  const handleNudgeAll = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    // In a real app, this would send notifications to all pending members
    logger.world.info('Nudge all pending members', { members: pendingMembers.map(m => m.name) });
  };



  // Render Sync Status Section
  const renderWorldAction = (action: WorldActionSection['action']) => {
    if (action === 'complete') {
      const hasPendingMembers = pendingMembers.length > 0;
      
      return (
        <View style={styles.actionSection}>
          <Pressable
            onPress={hasPendingMembers ? undefined : handleArchive}
            style={[styles.completeButton, hasPendingMembers && styles.completeButtonDisabled]}
            {...(hasPendingMembers ? {} : createPressHandlers(completeButtonScale))}
          >
            <Animated.View style={hasPendingMembers ? undefined : completeButtonAnimStyle}>
              <LinearGradient
                colors={hasPendingMembers ? [Colors.surface, Colors.surface] : [Colors.success, '#059669']}
                style={styles.completeButtonInner}
              >
                <Text style={[styles.completeButtonText, hasPendingMembers && styles.completeButtonTextDisabled]}>
                  Complete World
                </Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
          {hasPendingMembers && (
            <Text style={styles.completeButtonHint}>
              Waiting for {pendingMembers.length} {pendingMembers.length === 1 ? 'member' : 'members'} to add photos
            </Text>
          )}
        </View>
      );
    }

    return (
      <View style={styles.actionSection}>
        <Pressable
          onPress={handleRelive}
          style={styles.reliveButton}
          {...createPressHandlers(reliveButtonScale)}
        >
          <Animated.View style={reliveButtonAnimStyle}>
            <LinearGradient
              colors={[Colors.accent, Colors.accentDark]}
              style={styles.reliveButtonInner}
            >
              <Ionicons name="play" size={18} color={Colors.textPrimary} />
              <Text style={styles.reliveButtonText}>Relive This Memory</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>
    );
  };

  const toggleSyncStatus = () => {
    setIsSyncStatusExpanded((prev) => !prev);
  };

  const renderSyncStatus = (syncMembers: DisplayMember[]) => (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.syncStatusWrapper}
    >
      <View style={styles.syncStatusContainer}>
        <Pressable
          onPress={toggleSyncStatus}
          style={[
            styles.syncStatusHeaderRow,
            isSyncStatusExpanded && styles.syncStatusHeaderRowExpanded,
          ]}
        >
          <View style={styles.syncStatusHeaderText}>
            <Text style={styles.syncStatusTitle}>Waiting for photos</Text>
            <Text style={styles.syncStatusSubtitle}>
              {syncMembers.length} {syncMembers.length === 1 ? 'person' : 'people'} haven't added yet
            </Text>
          </View>
          <Ionicons
            name={isSyncStatusExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textSecondary}
          />
        </Pressable>
        {isSyncStatusExpanded && (
          <>
            <View style={styles.syncStatusMembers}>
              {syncMembers.map((member) => (
                <View
                  key={member.id}
                  style={styles.syncMemberItem}
                >
                  <Avatar
                    uri={member.avatar ?? undefined}
                    name={member.name}
                    size="medium"
                  />
                  <View style={styles.syncMemberInfo}>
                    <Text style={styles.syncMemberName}>{member.name}</Text>
                    <Text style={styles.syncMemberStatus}>
                      {member.syncStatus === 'syncing' ? 'Uploading...' : 'Not added yet'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Pressable style={styles.nudgeAllButton} onPress={handleNudgeAll}>
              <Text style={styles.nudgeAllButtonText}>Nudge All</Text>
            </Pressable>
          </>
        )}
      </View>
    </Animated.View>
  );

  // Empty state component for when there are no photos
  const renderEmptyState = () => (
    <Animated.View
      entering={FadeInUp.delay(200).duration(400)}
      style={styles.emptyStateContainer}
    >
      {/* Visual */}
      <View style={styles.emptyStateVisual}>
        <View style={styles.emptyStateIconBg}>
          <View style={styles.emptyStateCameraIcon}>
            <View style={styles.cameraBody} />
            <View style={styles.cameraLens} />
            <View style={styles.cameraFlash} />
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.emptyStateContent}>
        {isArchived ? (
          <>
            <Text style={styles.emptyStateTitle}>No photos yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              This World was archived without any photos being added.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.emptyStateTitle}>Be the first to add photos</Text>
            <Text style={styles.emptyStateSubtitle}>
              Capture moments from this experience and share them with everyone.
            </Text>
          </>
        )}
      </View>

      {/* CTA for active worlds */}
      {!isArchived && (
        <Pressable
          onPress={handleAddPhotos}
          {...createPressHandlers(fabScale)}
          style={styles.emptyStateCta}
        >
          <Animated.View style={fabStyle}>
            <LinearGradient
              colors={[Colors.accent, Colors.accentDark]}
              style={styles.emptyStateButton}
            >
              <Ionicons name="add" size={20} color={Colors.textPrimary} />
              <Text style={styles.emptyStateButtonText}>Add Photos</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      )}

      {/* Helpful tips */}
      {!isArchived && (
        <View style={styles.emptyStateTips}>
          <View style={styles.emptyStateTip}>
            <Ionicons name="camera-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.tipText}>Photos from your camera roll</Text>
          </View>
          <View style={styles.emptyStateTipDot} />
          <View style={styles.emptyStateTip}>
            <Ionicons name="sync-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.tipText}>Auto-syncs with members</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    if (item.type === 'sync-status') {
      return renderSyncStatus(item.members);
    }

    if (item.type === 'world-action') {
      return renderWorldAction(item.action);
    }

    if (item.type === 'date') {
      return (
        <Animated.View
          entering={FadeIn.delay(50).duration(300)}
          style={styles.dateHeader}
        >
          <Text style={styles.dateHeaderText}>{item.label}</Text>
          <Text style={styles.dateHeaderCount}>{item.photoCount}</Text>
        </Animated.View>
      );
    }

    return (
      <View style={styles.photoRow}>
        {item.photos.map((photo) => (
          <Pressable
            key={photo.id}
            onPress={() => handlePhotoPress(photo)}
            style={styles.photoContainer}
          >
            <Image
              source={{ uri: photo.thumbnailUri || photo.uri }}
              style={styles.photo}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)']}
              style={styles.photoGradient}
            />
            {/* Video indicator */}
            {photo.type === 'video' && (
              <View style={styles.videoIndicator}>
                <Ionicons name="play" size={10} color={Colors.textPrimary} />
                {photo.duration && (
                  <Text style={styles.videoDuration}>
                    {formatDuration(photo.duration)}
                  </Text>
                )}
              </View>
            )}
            <View style={styles.photoOwner}>
              <Avatar
                uri={photo.owner.avatar ?? undefined}
                name={photo.owner.name}
                size="small"
              />
            </View>
          </Pressable>
        ))}
        {item.photos.length < PHOTO_COLUMNS &&
          Array(PHOTO_COLUMNS - item.photos.length).fill(null).map((_, i) => (
            <View key={`empty-${i}`} style={styles.photoContainer} />
          ))
        }
      </View>
    );
  };


  return (
    <RequireAuth>
      <View style={styles.container}>
        {/* Floating Navigation Bar */}
        <View style={[styles.navBar, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable
            onPress={handleBack}
            {...createPressHandlers(backButtonScale)}
          >
            <Animated.View style={[styles.navButton, backButtonStyle]}>
              <BlurView intensity={50} tint="dark" style={styles.navButtonBlur}>
                <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
              </BlurView>
            </Animated.View>
          </Pressable>

          <Animated.View style={[styles.stickyTitleContainer, stickyTitleOpacity]}>
            <Text style={styles.stickyTitle} numberOfLines={1}>
              {world.title}
            </Text>
          </Animated.View>

          <Pressable
            onPress={handleShare}
            {...createPressHandlers(shareButtonScale)}
          >
            <Animated.View style={[styles.navButton, shareButtonStyle]}>
              <BlurView intensity={50} tint="dark" style={styles.navButtonBlur}>
                <Ionicons name="share-outline" size={18} color={Colors.textPrimary} />
              </BlurView>
            </Animated.View>
          </Pressable>
        </View>

        {/* Main Content */}
        <Animated.FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeaderComponent}
          ListEmptyComponent={photos.length === 0 ? renderEmptyState : null}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        />

        {/* FAB - Add Photos for non-archived worlds */}
        {!isArchived && (
          <Pressable
            style={[styles.fab, { bottom: 24 + insets.bottom }]}
            onPress={handleAddPhotos}
            {...createPressHandlers(fabScale)}
          >
            <Animated.View style={fabStyle}>
              <LinearGradient
                colors={[Colors.accent, Colors.accentDark]}
                style={styles.fabGradient}
              >
                <Ionicons name="add" size={20} color={Colors.textPrimary} />
                <Text style={styles.fabText}>Add Photos</Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        )}

        {/* Archive Confirmation Modal */}
        {showArchiveConfirm && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.confirmOverlay}
          >
            <BlurView intensity={40} tint="dark" style={styles.confirmBlur}>
              <Animated.View
                entering={FadeInUp.duration(300)}
                style={styles.confirmCard}
              >
                <View style={styles.confirmIconContainer}>
                  <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
                </View>
                <Text style={styles.confirmTitle}>Complete this World?</Text>
                <Text style={styles.confirmMessage}>
                  This will archive the World and preserve it as a memory. Make sure everyone has added their photos first.
                </Text>
                <View style={styles.confirmButtons}>
                  <Pressable style={styles.confirmCancelButton} onPress={cancelArchive}>
                    <Text style={styles.confirmCancelText}>Not Yet</Text>
                  </Pressable>
                  <Pressable style={styles.confirmActionButton} onPress={confirmArchive}>
                    <LinearGradient
                      colors={[Colors.success, '#059669']}
                      style={styles.confirmActionGradient}
                    >
                      <Text style={styles.confirmActionText}>Complete</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </Animated.View>
            </BlurView>
          </Animated.View>
        )}

        {/* Archive Celebration Modal */}
        <ArchiveCelebration
          visible={showCelebration}
          worldTitle={world.title}
          photoCount={photos.length}
          memberCount={members.length}
          onDismiss={handleCelebrationDismiss}
          onRelive={handleCelebrationRelive}
        />
      </View>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    marginTop: Spacing.sm,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  refreshText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },

  // Navigation Bar
  navBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  navButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backIconContainer: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronLine1: {
    position: 'absolute',
    width: 10,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateY: -3 }],
  },
  chevronLine2: {
    position: 'absolute',
    width: 10,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateY: 3 }],
  },
  stickyTitleContainer: {
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  stickyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Header
  header: {
    height: HEADER_MAX_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  coverImage: {
    width: SCREEN_WIDTH,
    height: HEADER_MAX_HEIGHT + 50,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerTopContent: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
  },
  headerBottomContent: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
  },

  // Status badges
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusBadgeBuilding: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  statusBadgeArchived: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: Colors.success,
  },
  statusDotBuilding: {
    backgroundColor: '#6366F1',
  },
  statusDotArchived: {
    backgroundColor: Colors.textSecondary,
  },
  statusText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  dateBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  dateText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    opacity: 0.9,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: TITLE_FONT_SIZE,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
    lineHeight: TITLE_LINE_HEIGHT,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  inviteButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inviteButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Relive Button - Full width prominent action for archived worlds
  reliveButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  reliveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  relivePlayIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: Colors.textPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  reliveButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },

  // Complete Button - prominent action for building worlds
  completeButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  completeButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  completeButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  completeButtonHint: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // Sync Status Section
  actionSection: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  syncStatusWrapper: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  syncStatusContainer: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  syncStatusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncStatusHeaderRowExpanded: {
    marginBottom: Spacing.sm,
  },
  syncStatusHeaderText: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  syncStatusTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  syncStatusSubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  syncStatusMembers: {
    gap: Spacing.sm,
  },
  syncMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  syncMemberInfo: {
    flex: 1,
  },
  syncMemberName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  syncMemberStatus: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  nudgeAllButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  nudgeAllButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },

  // Date Headers
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  dateHeaderText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  dateHeaderCount: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },

  // Photo Grid
  photoRow: {
    flexDirection: 'row',
    gap: PHOTO_GAP,
  },
  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    backgroundColor: Colors.surface,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  photoOwner: {
    position: 'absolute',
    bottom: 6,
    left: 6,
  },
  
  // Video indicator
  videoIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  videoPlayIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftColor: Colors.textPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  videoDuration: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '600',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    ...Shadows.glow,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    gap: Spacing.sm,
    ...Shadows.glow,
  },
  fabIcon: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPlus1: {
    position: 'absolute',
    width: 14,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
  },
  fabPlus2: {
    position: 'absolute',
    width: 2,
    height: 14,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
  },
  fabText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },

  // Error State
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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

  // Empty State for World with no photos
  emptyStateContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  emptyStateVisual: {
    marginBottom: Spacing.xl,
  },
  emptyStateIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyStateCameraIcon: {
    width: 48,
    height: 40,
    position: 'relative',
  },
  cameraBody: {
    position: 'absolute',
    bottom: 0,
    width: 48,
    height: 32,
    backgroundColor: Colors.textMuted,
    borderRadius: 8,
  },
  cameraLens: {
    position: 'absolute',
    bottom: 6,
    left: 14,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 3,
    borderColor: Colors.textSecondary,
  },
  cameraFlash: {
    position: 'absolute',
    top: 0,
    left: 12,
    width: 16,
    height: 10,
    backgroundColor: Colors.textMuted,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  emptyStateContent: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyStateTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * 1.5,
    paddingHorizontal: Spacing.md,
  },
  emptyStateCta: {
    marginBottom: Spacing.xl,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  emptyStateButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  emptyStateTips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyStateTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tipIcon: {
    fontSize: 14,
  },
  tipText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  emptyStateTipDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    opacity: 0.5,
  },

  // Confirmation Modal
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmBlur: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: Spacing.lg,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  confirmIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  confirmIcon: {
    width: 28,
    height: 28,
    position: 'relative',
  },
  confirmCheckShort: {
    position: 'absolute',
    bottom: 8,
    left: 2,
    width: 10,
    height: 3,
    backgroundColor: Colors.success,
    borderRadius: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  confirmCheckLong: {
    position: 'absolute',
    bottom: 10,
    left: 8,
    width: 18,
    height: 3,
    backgroundColor: Colors.success,
    borderRadius: 1.5,
    transform: [{ rotate: '-45deg' }],
  },
  confirmTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * 1.5,
    marginBottom: Spacing.xl,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
  },
  confirmCancelText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  confirmActionButton: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  confirmActionGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  confirmActionText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
});
