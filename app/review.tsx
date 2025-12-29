import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { PhotoGrid, Toast } from '@/components';
import type { Photo } from '@/components/PhotoGrid';
import { RequireAuth } from '@/components/RequireAuth';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { uploadMultipleMedia, updateSyncStatus } from '@/lib/api';

// ============================================================================
// TYPES
// ============================================================================

interface UploadProgress {
  completed: number;
  total: number;
  currentFile?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Transform MediaLibrary asset to Photo format for PhotoGrid
 */
function assetToPhoto(asset: MediaLibrary.Asset): Photo {
  return {
    id: asset.id,
    uri: asset.uri,
    type: asset.mediaType === 'video' ? 'video' : 'image',
    width: asset.width,
    height: asset.height,
    duration: asset.duration,
  };
}

/**
 * Get end of day timestamp for a date string
 */
function getEndOfDay(dateString: string): number {
  const date = new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Get start of day timestamp for a date string
 */
function getStartOfDay(dateString: string): number {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Review Screen - Camera Roll Integration
 * 
 * Loads photos from device camera roll filtered by date range,
 * allows selection, and uploads to Supabase storage.
 */
export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    worldId?: string;
    worldName?: string;
    startDate?: string;
    endDate?: string;
    coverUri?: string;
  }>();

  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // Data state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Toast state
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // Computed values
  const allSelected = selectedIds.length === photos.length && photos.length > 0;
  const hasSelection = selectedIds.length > 0;

  // ============================================================================
  // PERMISSIONS & DATA LOADING
  // ============================================================================

  /**
   * Request media library permissions
   */
  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Media library not available on web
      setPermissionStatus('denied' as MediaLibrary.PermissionStatus);
      setLoading(false);
      return;
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    setPermissionStatus(status);
    return status;
  }, []);

  /**
   * Load photos from camera roll filtered by date range
   */
  const loadPhotos = useCallback(async () => {
    if (!params.startDate || !params.endDate) {
      console.warn('Missing date range params');
      setLoading(false);
      return;
    }

    try {
      const startTimestamp = getStartOfDay(params.startDate);
      const endTimestamp = getEndOfDay(params.endDate);

      // Query camera roll
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo', 'video'],
        createdAfter: startTimestamp,
        createdBefore: endTimestamp,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]], // Newest first
        first: 500, // Reasonable limit
      });

      // Transform to Photo format
      const photoList = assets.map(assetToPhoto);
      setPhotos(photoList);

      // Select all by default
      setSelectedIds(photoList.map(p => p.id));
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  }, [params.startDate, params.endDate]);

  /**
   * Initialize: request permissions and load photos
   */
  useEffect(() => {
    const init = async () => {
      const status = await requestPermission();
      if (status === 'granted') {
        await loadPhotos();
      } else {
        setLoading(false);
      }
    };
    init();
  }, [requestPermission, loadPhotos]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSelectionChange = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const handleToggleSelectAll = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedIds(allSelected ? [] : photos.map(p => p.id));
  };

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleOpenSettings = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openSettings();
  };

  /**
   * Upload selected photos to the world
   */
  const handleAddPhotos = useCallback(async () => {
    if (!params.worldId || selectedIds.length === 0) return;

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setUploading(true);
    setUploadProgress({ completed: 0, total: selectedIds.length });

    try {
      // Update sync status to 'syncing'
      await updateSyncStatus(params.worldId, 'syncing');

      // Get full asset info for selected photos (need local URI)
      const selectedPhotos = photos.filter(p => selectedIds.includes(p.id));
      
      // Prepare files for upload
      const files = await Promise.all(
        selectedPhotos.map(async (photo) => {
          // Get asset info to get the local URI
          const assetInfo = await MediaLibrary.getAssetInfoAsync(photo.id);
          return {
            uri: assetInfo.localUri || photo.uri,
            type: photo.type || 'image',
            width: photo.width,
            height: photo.height,
            duration: photo.duration,
            takenAt: assetInfo.creationTime
              ? new Date(assetInfo.creationTime).toISOString()
              : undefined,
          };
        })
      );

      // Upload with progress tracking
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

      // Update sync status to 'synced'
      await updateSyncStatus(params.worldId, 'synced');

      // Show result
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
    } catch (error) {
      console.error('Upload error:', error);
      setToast({
        visible: true,
        message: 'Upload failed. Please try again.',
      });
      // Revert sync status on error
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
    // Navigate to world detail after upload
    if (params.worldId) {
      router.replace(`/world/${params.worldId}`);
    }
  }, [router, params.worldId]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Render permission denied state
   */
  const renderPermissionDenied = () => (
    <View style={styles.centerContainer}>
      <View style={styles.permissionIcon}>
        <Ionicons name="images-outline" size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.permissionTitle}>Photo Access Required</Text>
      <Text style={styles.permissionMessage}>
        Worlding needs access to your photos to find memories from this event.
      </Text>
      <Pressable style={styles.settingsButton} onPress={handleOpenSettings}>
        <Text style={styles.settingsButtonText}>Open Settings</Text>
      </Pressable>
      <Pressable style={styles.backButton} onPress={handleClose}>
        <Text style={styles.backButtonText}>Go Back</Text>
      </Pressable>
    </View>
  );

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>Finding your memories...</Text>
    </View>
  );

  /**
   * Render empty state (no photos found)
   */
  const renderEmpty = () => (
    <View style={styles.centerContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="camera-outline" size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No photos found</Text>
      <Text style={styles.emptyMessage}>
        We couldn't find any photos from{' '}
        {params.worldName || 'this date range'}.
      </Text>
      <Pressable style={styles.backButton} onPress={handleClose}>
        <Text style={styles.backButtonText}>Go Back</Text>
      </Pressable>
    </View>
  );

  /**
   * Render upload progress overlay
   */
  const renderUploadProgress = () => (
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

  /**
   * Render web not supported state
   */
  const renderWebNotSupported = () => (
    <View style={styles.centerContainer}>
      <View style={styles.permissionIcon}>
        <Ionicons name="phone-portrait-outline" size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.permissionTitle}>Use the mobile app</Text>
      <Text style={styles.permissionMessage}>
        Photo sync is only available on iOS and Android devices.
      </Text>
      <Pressable style={styles.backButton} onPress={handleClose}>
        <Text style={styles.backButtonText}>Go Back</Text>
      </Pressable>
    </View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Web not supported
  if (Platform.OS === 'web') {
    return (
      <RequireAuth>
        <SafeAreaView style={styles.container}>
          {renderWebNotSupported()}
        </SafeAreaView>
      </RequireAuth>
    );
  }

  // Permission denied
  if (permissionStatus && permissionStatus !== 'granted') {
    return (
      <RequireAuth>
        <SafeAreaView style={styles.container}>
          {renderPermissionDenied()}
        </SafeAreaView>
      </RequireAuth>
    );
  }

  // Loading
  if (loading) {
    return (
      <RequireAuth>
        <SafeAreaView style={styles.container}>
          {renderLoading()}
        </SafeAreaView>
      </RequireAuth>
    );
  }

  // Empty state
  if (photos.length === 0) {
    return (
      <RequireAuth>
        <SafeAreaView style={styles.container}>
          {renderEmpty()}
        </SafeAreaView>
      </RequireAuth>
    );
  }

  // Main content
  return (
    <RequireAuth>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              Found {photos.length} memories
            </Text>
            <Text style={styles.headerSubtitle}>
              from {params.worldName || 'your camera roll'}
            </Text>
          </View>

          <Pressable
            style={styles.selectAllButton}
            onPress={handleToggleSelectAll}
          >
            <Text style={styles.selectAllText}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </Text>
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
            <Ionicons name="sparkles" size={16} color={Colors.success} />
            <Text style={styles.scanText}>
              {selectedIds.length} of {photos.length} selected
            </Text>
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

        {/* Floating Add Button */}
        <Animated.View
          entering={FadeIn.delay(500).duration(400)}
          style={styles.floatingButtonContainer}
        >
          <View style={styles.privacyBadge}>
            <Ionicons name="lock-closed" size={14} color={Colors.textSecondary} />
            <Text style={styles.privacyText}>
              Only selected photos are uploaded
            </Text>
          </View>

          {hasSelection ? (
            <Pressable
              onPress={handleAddPhotos}
              style={styles.addButtonPressable}
              disabled={uploading}
            >
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
          ) : (
            <View style={styles.addButtonDisabled}>
              <Text style={styles.addButtonTextDisabled}>
                Select photos to add
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Upload Progress Overlay */}
        {uploading && renderUploadProgress()}

        {/* Success Toast */}
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

  // Center container for loading/empty/permission states
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Permission denied
  permissionIcon: {
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
  permissionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  permissionMessage: {
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

  // Loading
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    marginTop: Spacing.lg,
  },

  // Empty state
  emptyIcon: {
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
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: Typography.sizes.md * 1.5,
  },

  // Header
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

  // Scan complete banner
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
  scanText: {
    color: Colors.success,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },

  // Grid
  gridContainer: {
    flex: 1,
  },

  // Floating button
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
  privacyText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
  },
  addButtonPressable: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
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
  addButtonDisabled: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addButtonTextDisabled: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },

  // Upload overlay
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
