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
import { usePrivacyPrefs } from '@/hooks/usePrivacyPrefs';
import { uploadMultipleMedia, updateSyncStatus } from '@/lib/api';
import {
  getHiddenPhotos,
  getPreSelectedIds,
  getVisiblePhotos,
  loadPhotosWithFiltering,
  type FilteredPhoto,
} from '@/lib/photo-filter';

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

function toGridPhoto(photo: FilteredPhoto): Photo {
  return {
    id: photo.id,
    uri: photo.localUri || photo.uri,
    type: photo.type,
    width: photo.width,
    height: photo.height,
    duration: photo.duration,
  };
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
  const { prefs, loading: privacyLoading } = usePrivacyPrefs();

  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // Data state
  const [filteredPhotos, setFilteredPhotos] = useState<FilteredPhoto[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'included' | 'hidden'>('included');

  // Toast state
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const excludedAlbumIds = useMemo(
    () => prefs.excludedAlbums.map((album) => album.id),
    [prefs.excludedAlbums]
  );

  const visiblePhotos = useMemo(
    () => getVisiblePhotos(filteredPhotos),
    [filteredPhotos]
  );

  const hiddenPhotos = useMemo(
    () => getHiddenPhotos(filteredPhotos),
    [filteredPhotos]
  );

  const totalCount = filteredPhotos.length;
  const tabPhotos = activeTab === 'included' ? visiblePhotos : hiddenPhotos;
  const tabPhotoIds = useMemo(() => tabPhotos.map((photo) => photo.id), [tabPhotos]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedInTab = useMemo(
    () => tabPhotoIds.filter((id) => selectedIdSet.has(id)).length,
    [selectedIdSet, tabPhotoIds]
  );

  const allSelectedInTab = tabPhotoIds.length > 0 && selectedInTab === tabPhotoIds.length;
  const hasSelection = selectedIds.length > 0;
  const gridPhotos = useMemo(() => tabPhotos.map(toGridPhoto), [tabPhotos]);

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
    if (status !== 'granted') {
      setLoading(false);
    }
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
      setLoading(true);
      const result = await loadPhotosWithFiltering({
        startDate: params.startDate,
        endDate: params.endDate,
        excludedAlbumIds,
        pageSize: 500,
      });

      setFilteredPhotos(result.photos);
      setSelectedIds(getPreSelectedIds(result.photos));
      setActiveTab('included');
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  }, [excludedAlbumIds, params.endDate, params.startDate]);

  /**
   * Initialize: request permissions and load photos
   */
  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (permissionStatus !== 'granted') return;
    if (privacyLoading) return;
    void loadPhotos();
  }, [permissionStatus, privacyLoading, loadPhotos]);

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
    if (tabPhotoIds.length === 0) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedInTab) {
        tabPhotoIds.forEach((id) => next.delete(id));
      } else {
        tabPhotoIds.forEach((id) => next.add(id));
      }
      return Array.from(next);
    });
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

      const selectedPhotos = filteredPhotos.filter((photo) => selectedIds.includes(photo.id));
      const files = selectedPhotos.map((photo) => ({
        uri: photo.localUri || photo.uri,
        type: photo.type,
        width: photo.width,
        height: photo.height,
        duration: photo.duration,
        takenAt: photo.creationTime
          ? new Date(photo.creationTime).toISOString()
          : undefined,
      }));

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
  }, [filteredPhotos, params.worldId, params.worldName, selectedIds]);

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
  if (totalCount === 0) {
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
              Found {totalCount} memories
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
              {allSelectedInTab ? 'Deselect All' : 'Select All'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Tabs */}
        <View style={styles.tabSection}>
          <Pressable
            onPress={() => setActiveTab('included')}
            style={styles.tabItem}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'included' && styles.tabTextActive,
              ]}
            >
              Recommended ({visiblePhotos.length})
            </Text>
            {activeTab === 'included' && <View style={styles.tabIndicator} />}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('hidden')}
            style={styles.tabItem}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'hidden' && styles.tabTextActive,
              ]}
            >
              Hidden ({hiddenPhotos.length})
            </Text>
            {activeTab === 'hidden' && <View style={styles.tabIndicator} />}
          </Pressable>
        </View>

        {/* Scanning Complete Banner */}
        {tabPhotoIds.length > 0 && (
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
              {activeTab === 'included' ? 'Recommended' : 'Hidden'}: {selectedInTab} of {tabPhotoIds.length} selected
            </Text>
          </LinearGradient>
        </Animated.View>
      )}

        {/* Hidden info */}
        {activeTab === 'hidden' && (
          <View style={styles.hiddenInfo}>
            <View style={styles.hiddenHeader}>
              <Text style={styles.hiddenTitle}>Hidden by default</Text>
              {hiddenPhotos.length > 0 && (
                <Pressable
                  onPress={handleToggleSelectAll}
                  style={styles.includeAllButton}
                >
                  <Text style={styles.includeAllText}>
                    {allSelectedInTab ? 'Remove All' : 'Include All'}
                  </Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.hiddenSubtitle}>
              Screenshots and downloads are tucked away. Tap any photo to include it.
            </Text>
          </View>
        )}

        {/* Photo Grid */}
        <View style={styles.gridContainer}>
          {gridPhotos.length === 0 ? (
            <View style={styles.tabEmptyState}>
              <Ionicons name="image-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.tabEmptyTitle}>
                {activeTab === 'included' ? 'No recommended photos' : 'No hidden photos'}
              </Text>
              <Text style={styles.tabEmptySubtitle}>
                {activeTab === 'included'
                  ? 'Try checking Hidden for screenshots or downloads.'
                  : 'Everything looks good in your camera roll.'}
              </Text>
              {activeTab === 'included' && hiddenPhotos.length > 0 && (
                <Pressable
                  style={styles.tabEmptyAction}
                  onPress={() => setActiveTab('hidden')}
                >
                  <Text style={styles.tabEmptyActionText}>View Hidden Photos</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <PhotoGrid
              photos={gridPhotos}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              showOwnerAvatar={false}
            />
          )}
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

  // Tabs
  tabSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    paddingVertical: Spacing.sm,
    position: 'relative',
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.textPrimary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
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
  tabEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  tabEmptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  tabEmptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: Typography.sizes.sm * 1.5,
    marginTop: Spacing.sm,
    maxWidth: 260,
  },
  tabEmptyAction: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  tabEmptyActionText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },

  // Hidden info
  hiddenInfo: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hiddenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hiddenTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  hiddenSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.xs,
    lineHeight: Typography.sizes.sm * 1.4,
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
