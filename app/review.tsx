/**
 * Review Screen - Camera Roll Integration
 *
 * Apple Photos-inspired design with:
 * - Day-grouped photo grid
 * - Smart filtering (Recommended / Hidden / Videos)
 * - Burst photo grouping
 * - Infinite scroll pagination
 * - 50+ photos selection prompt
 * - Video size warnings
 */

import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  FilterChips,
  ReviewBottomBar,
  ReviewHeader,
  SkeletonGrid,
  Toast,
  formatDateRange,
  createFilterChips,
} from '@/components';
import type { FilterChip } from '@/components';
import { RequireAuth } from '@/components/RequireAuth';
import { Colors, Radius, Spacing, Typography, Layout } from '@/constants/theme';
import { usePrivacyPrefs } from '@/hooks/usePrivacyPrefs';
import { useInfinitePhotos, PRESELECT_THRESHOLD } from '@/hooks/useInfinitePhotos';
import { useBurstGroups } from '@/hooks/useBurstGroups';
import { uploadMultipleMedia, updateSyncStatus } from '@/lib/api';
import { logger } from '@/lib/logger';
import {
  getHiddenPhotos,
  getPreSelectedIds,
  getVisiblePhotos,
  getBufferPhotoIds,
  getVideos,
  calculateTotalVideoSize,
  type FilteredPhoto,
} from '@/lib/photo-filter';

// ============================================================================
// TYPES
// ============================================================================

interface UploadProgress {
  completed: number;
  total: number;
}

interface PhotoSection {
  title: string;
  date: Date;
  data: FilteredPhoto[];
}

type FilterType = 'recommended' | 'hidden' | 'videos';

// ============================================================================
// HELPERS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMNS = Layout.photoGridColumns;
const GAP = Layout.photoGridGap;
const ITEM_SIZE = (SCREEN_WIDTH - Spacing.md * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

/**
 * Group photos by day for section headers
 */
function groupPhotosByDay(photos: FilteredPhoto[]): PhotoSection[] {
  const groups = new Map<string, FilteredPhoto[]>();

  for (const photo of photos) {
    const date = new Date(photo.effectiveDate);
    const dateKey = date.toDateString();

    const existing = groups.get(dateKey) || [];
    existing.push(photo);
    groups.set(dateKey, existing);
  }

  // Convert to sections and sort by date (newest first)
  const sections: PhotoSection[] = [];
  for (const [dateKey, photos] of groups) {
    sections.push({
      title: formatSectionDate(new Date(dateKey)),
      date: new Date(dateKey),
      data: photos,
    });
  }

  sections.sort((a, b) => b.date.getTime() - a.date.getTime());
  return sections;
}

/**
 * Format date for section header (e.g., "Saturday, Dec 28")
 */
function formatSectionDate(date: Date): string {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${dayName}, ${month} ${day}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    worldId?: string;
    worldName?: string;
    startDate?: string;
    endDate?: string;
    coverUri?: string;
  }>();
  const { prefs, loading: privacyLoading } = usePrivacyPrefs();

  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);

  // UI state
  const [activeFilter, setActiveFilter] = useState<FilterType>('recommended');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // Memoized excluded album IDs
  const excludedAlbumIds = useMemo(
    () => prefs.excludedAlbums.map((album) => album.id),
    [prefs.excludedAlbums]
  );

  // Load all photos at once
  const {
    photos,
    loading,
    error,
    stats,
    refresh,
    initialized,
  } = useInfinitePhotos({
    startDate: params.startDate || '',
    endDate: params.endDate || '',
    excludedAlbumIds,
  });

  // Burst grouping hook
  const {
    groupedPhotos,
    burstGroups,
    expandedBurstId,
    toggleBurstExpansion,
    getDisplayPhotos,
    getBurstForPhoto,
  } = useBurstGroups(photos);

  // Filtered photos based on active filter
  const filteredPhotos = useMemo(() => {
    const displayPhotos = getDisplayPhotos();
    switch (activeFilter) {
      case 'recommended':
        return getVisiblePhotos(displayPhotos);
      case 'hidden':
        return getHiddenPhotos(displayPhotos);
      case 'videos':
        return getVideos(displayPhotos);
      default:
        return displayPhotos;
    }
  }, [activeFilter, getDisplayPhotos]);

  // Photo sections for SectionList
  const photoSections = useMemo(
    () => groupPhotosByDay(filteredPhotos),
    [filteredPhotos]
  );

  // Buffer photo IDs for styling
  const bufferPhotoIds = useMemo(
    () => getBufferPhotoIds(photos),
    [photos]
  );

  // Filter chip counts
  const filterChips = useMemo((): FilterChip[] => {
    const displayPhotos = getDisplayPhotos();
    return createFilterChips(
      getVisiblePhotos(displayPhotos).length,
      getHiddenPhotos(displayPhotos).length,
      getVideos(displayPhotos).length
    );
  }, [getDisplayPhotos]);

  // Total video size for warning
  const totalVideoSize = useMemo(
    () => calculateTotalVideoSize(photos, selectedIds),
    [photos, selectedIds]
  );

  // Date range string for header
  const dateRangeString = useMemo(() => {
    if (!params.startDate || !params.endDate) return '';
    return formatDateRange(params.startDate, params.endDate);
  }, [params.startDate, params.endDate]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Request permissions
  useEffect(() => {
    const requestPermission = async () => {
      if (Platform.OS === 'web') {
        setPermissionStatus('denied' as MediaLibrary.PermissionStatus);
        return;
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      setPermissionStatus(status);
    };

    void requestPermission();
  }, []);

  // Load photos when permission granted
  useEffect(() => {
    if (permissionStatus !== 'granted') return;
    if (privacyLoading) return;
    if (!params.startDate || !params.endDate) return;

    void refresh();
  }, [permissionStatus, privacyLoading, params.startDate, params.endDate, refresh]);

  // Auto pre-select for fewer than threshold photos
  useEffect(() => {
    if (initialized && photos.length > 0 && photos.length < PRESELECT_THRESHOLD && selectedIds.size === 0) {
      const preSelected = getPreSelectedIds(photos);
      setSelectedIds(new Set(preSelected));
    }
  }, [initialized, photos, selectedIds.size]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  }, [router]);

  const handleOpenSettings = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openSettings();
  }, []);

  const handlePhotoSelect = useCallback((photoId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const handleFilterChange = useCallback((filterId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveFilter(filterId as FilterType);
  }, []);

  const handleAddPhotos = useCallback(async () => {
    if (!params.worldId || selectedIds.size === 0) return;

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setUploading(true);
    setUploadProgress({ completed: 0, total: selectedIds.size });

    try {
      await updateSyncStatus(params.worldId, 'syncing');

      const selectedPhotos = photos.filter((photo) => selectedIds.has(photo.id));
      const files = selectedPhotos.map((photo) => ({
        uri: photo.localUri || photo.uri,
        type: photo.type,
        width: photo.width,
        height: photo.height,
        duration: photo.duration,
        takenAt: photo.effectiveDate
          ? new Date(photo.effectiveDate).toISOString()
          : undefined,
        livePhotoMovUri: photo.livePhotoMovUri,
      }));

      const result = await uploadMultipleMedia(
        params.worldId,
        files as Array<{
          uri: string;
          type: 'image' | 'video';
          width?: number;
          height?: number;
          duration?: number;
          takenAt?: string;
        }>,
        (completed, total) => {
          setUploadProgress({ completed, total });
        }
      );

      await updateSyncStatus(params.worldId, 'synced');

      const successCount = result.successful.length;
      const failCount = result.failed.length;

      if (failCount > 0) {
        setToast({
          visible: true,
          message: `Uploaded ${successCount} of ${successCount + failCount} photos`,
        });
      } else {
        setToast({
          visible: true,
          message: `Added ${successCount} photos to ${params.worldName || 'World'}`,
        });
      }
    } catch (err) {
      logger.upload.error('Upload error', err);
      setToast({
        visible: true,
        message: 'Upload failed. Please try again.',
      });
      if (params.worldId) {
        await updateSyncStatus(params.worldId, 'pending');
      }
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [params.worldId, params.worldName, selectedIds, photos]);

  const handleToastHide = useCallback(() => {
    setToast({ visible: false, message: '' });
    if (params.worldId) {
      router.replace(`/world/${params.worldId}`);
    }
  }, [router, params.worldId]);


  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderPhoto = useCallback(
    (photo: FilteredPhoto) => {
      const isSelected = selectedIds.has(photo.id);
      const isBuffer = bufferPhotoIds.has(photo.id);
      const burst = getBurstForPhoto(photo.id);

      return (
        <Pressable
          key={photo.id}
          onPress={() => handlePhotoSelect(photo.id)}
          onLongPress={() => {
            if (burst) {
              toggleBurstExpansion(burst.burstId);
            }
          }}
          style={[styles.photoItem, { width: ITEM_SIZE, height: ITEM_SIZE }]}
        >
          <Image
            source={{ uri: photo.localUri || photo.uri }}
            style={[styles.photoImage, isBuffer && styles.bufferPhoto]}
            resizeMode="cover"
          />

          {/* Burst badge */}
          {burst && photo.id === burst.representativePhotoId && expandedBurstId !== burst.burstId && (
            <View style={styles.burstBadge}>
              <Ionicons name="layers" size={10} color={Colors.textPrimary} />
              <Text style={styles.burstCount}>{burst.count}</Text>
            </View>
          )}

          {/* Video duration badge */}
          {photo.type === 'video' && photo.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {Math.floor(photo.duration / 60)}:{String(Math.floor(photo.duration % 60)).padStart(2, '0')}
              </Text>
            </View>
          )}

          {/* Live Photo badge */}
          {photo.isLivePhoto && (
            <View style={styles.livePhotoBadge}>
              <Ionicons name="radio-button-on" size={10} color={Colors.textPrimary} />
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
    },
    [selectedIds, bufferPhotoIds, getBurstForPhoto, expandedBurstId, toggleBurstExpansion, handlePhotoSelect]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: PhotoSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    []
  );

  const renderSection = useCallback(
    ({ section }: { section: PhotoSection }) => (
      <View style={styles.photoGrid}>
        {section.data.map(renderPhoto)}
      </View>
    ),
    [renderPhoto]
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="image-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>
          {activeFilter === 'recommended'
            ? 'No recommended photos'
            : activeFilter === 'hidden'
            ? 'No hidden photos'
            : 'No videos'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter === 'recommended'
            ? 'Try checking Hidden for screenshots or downloads.'
            : activeFilter === 'hidden'
            ? 'Everything looks good in your camera roll.'
            : 'No videos found in this date range.'}
        </Text>
      </View>
    ),
    [activeFilter]
  );

  const renderUploadOverlay = () => (
    <View style={styles.uploadOverlay}>
      <View style={styles.uploadCard}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.uploadTitle}>Uploading photos...</Text>
        {uploadProgress && (
          <Text style={styles.uploadProgress}>
            {uploadProgress.completed} of {uploadProgress.total}
          </Text>
        )}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: uploadProgress
                  ? `${(uploadProgress.completed / uploadProgress.total) * 100}%`
                  : '0%',
              },
            ]}
          />
        </View>
      </View>
    </View>
  );

  // ============================================================================
  // CONDITIONAL RENDERS
  // ============================================================================

  // Web not supported
  if (Platform.OS === 'web') {
    return (
      <RequireAuth>
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="phone-portrait-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.stateTitle}>Use the mobile app</Text>
            <Text style={styles.stateMessage}>
              Photo sync is only available on iOS and Android devices.
            </Text>
            <Pressable style={styles.backButton} onPress={handleClose}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </RequireAuth>
    );
  }

  // Permission denied
  if (permissionStatus && permissionStatus !== 'granted') {
    return (
      <RequireAuth>
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="images-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.stateTitle}>Photo Access Required</Text>
            <Text style={styles.stateMessage}>
              Worlding needs access to your photos to find memories from this event.
            </Text>
            <Pressable style={styles.settingsButton} onPress={handleOpenSettings}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </Pressable>
            <Pressable style={styles.backButton} onPress={handleClose}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </RequireAuth>
    );
  }

  // Loading (initial)
  if (loading && !initialized) {
    return (
      <RequireAuth>
        <SafeAreaView style={styles.container}>
          <ReviewHeader
            dateRange={dateRangeString}
            photoCount={0}
            onClose={handleClose}
          />
          <SkeletonGrid loadingText="Finding photos..." />
        </SafeAreaView>
      </RequireAuth>
    );
  }

  // Empty state (no photos found at all)
  if (initialized && photos.length === 0) {
    return (
      <RequireAuth>
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="camera-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.stateTitle}>No photos found</Text>
            <Text style={styles.stateMessage}>
              We couldn't find any photos from {params.worldName || 'this date range'}.
            </Text>
            <Pressable style={styles.backButton} onPress={handleClose}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </RequireAuth>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <RequireAuth>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <ReviewHeader
          dateRange={dateRangeString}
          photoCount={photos.length}
          onClose={handleClose}
        />

        {/* Filter chips */}
        <FilterChips
          chips={filterChips}
          activeChipId={activeFilter}
          onChipPress={handleFilterChange}
        />

        {/* Photo grid */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.gridContainer}>
          {photoSections.length === 0 ? (
            renderEmpty()
          ) : (
            <SectionList
              sections={photoSections}
              keyExtractor={(item) => item.id}
              renderSectionHeader={renderSectionHeader}
              renderItem={() => null}
              renderSectionFooter={renderSection}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>

        {/* Bottom bar */}
        <ReviewBottomBar
          selectedCount={selectedIds.size}
          totalVideoSize={totalVideoSize}
          onAddPhotos={handleAddPhotos}
          disabled={selectedIds.size === 0}
          uploading={uploading}
        />

        {/* Upload progress overlay */}
        {uploading && renderUploadOverlay()}

        {/* Success toast */}
        <Toast
          visible={toast.visible}
          message={toast.message}
          duration={2000}
          onHide={handleToastHide}
        />
      </SafeAreaView>
    </RequireAuth>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stateTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stateMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: Typography.sizes.md * 1.5,
  },
  settingsButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  settingsButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  gridContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  sectionHeader: {
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  photoItem: {
    position: 'relative',
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  bufferPhoto: {
    opacity: 0.7,
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
    gap: 2,
  },
  burstCount: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  durationBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  durationText: {
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  livePhotoBadge: {
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: Typography.sizes.sm * 1.5,
    marginTop: Spacing.sm,
    maxWidth: 260,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  uploadCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: 280,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uploadTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  uploadProgress: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    marginBottom: Spacing.lg,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
});
