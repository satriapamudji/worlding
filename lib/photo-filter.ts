/**
 * Photo Filtering Utility
 *
 * Cross-platform photo filtering with smart classification for iOS and Android.
 * Handles screenshot detection, download detection, and excluded album filtering.
 */

import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

/** Classification of a photo based on its source */
export type PhotoClassification = 'camera' | 'screenshot' | 'downloaded' | 'other';

/** A photo with classification metadata */
export interface FilteredPhoto {
  id: string;
  uri: string;
  localUri: string;
  type: 'image' | 'video';
  width: number;
  height: number;
  duration?: number;
  creationTime: number;
  classification: PhotoClassification;
  filename: string;
}

/** Statistics about filtered photos */
export interface PhotoFilterStats {
  total: number;
  camera: number;
  screenshots: number;
  downloads: number;
  other: number;
  excludedByAlbum: number;
}

/** Result from loading and filtering photos */
export interface FilterResult {
  photos: FilteredPhoto[];
  stats: PhotoFilterStats;
  hasMore: boolean;
  endCursor: string | null;
}

/** Options for loading photos */
export interface LoadPhotosOptions {
  startDate: string;
  endDate: string;
  excludedAlbumIds: string[];
  pageSize?: number;
  after?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Batch size for processing asset info (balance between speed and memory) */
const ASSET_INFO_BATCH_SIZE = 50;

/** Maximum photos to load in a single query */
const DEFAULT_PAGE_SIZE = 500;

// ============================================================================
// FILENAME PATTERN DETECTION
// ============================================================================

/**
 * Detect if a filename indicates a screenshot
 */
function isScreenshotByFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.includes('screenshot') ||
    lower.includes('screen shot') ||
    lower.includes('screen_shot') ||
    lower.includes('captura') || // Spanish
    lower.includes('bildschirmfoto') // German
  );
}

/**
 * Detect if a filename indicates a downloaded/shared photo
 * (WhatsApp, Telegram, messaging apps, web downloads)
 */
function isDownloadedByFilename(filename: string): boolean {
  const lower = filename.toLowerCase();

  // WhatsApp pattern: IMG-YYYYMMDD-WAxxxx
  const isWhatsApp =
    lower.includes('whatsapp') || /img-\d{8}-wa\d+/i.test(filename);

  // Telegram pattern
  const isTelegram = lower.includes('telegram');

  // Other messaging apps
  const isMessenger =
    lower.includes('messenger') ||
    lower.includes('signal') ||
    lower.includes('viber') ||
    lower.includes('snapchat');

  // Downloaded from web
  const isWebDownload =
    lower.includes('download') ||
    lower.includes('saved') ||
    lower.includes('received');

  // Social media saves
  const isSocialMedia =
    lower.includes('instagram') ||
    lower.includes('twitter') ||
    lower.includes('facebook') ||
    lower.includes('tiktok');

  return isWhatsApp || isTelegram || isMessenger || isWebDownload || isSocialMedia;
}

/**
 * Check if file format is never from device camera
 */
function isNeverCameraFormat(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  // WEBP, GIF = always downloaded (not native camera formats)
  // MP4 on iOS = usually downloaded (iOS camera uses MOV)
  return (
    ['webp', 'gif'].includes(extension) ||
    (Platform.OS === 'ios' && extension === 'mp4')
  );
}

// ============================================================================
// PLATFORM-SPECIFIC CLASSIFICATION
// ============================================================================

/**
 * Classify a photo on iOS using mediaSubtypes (fast, no extra API call)
 */
function classifyPhotoIOS(
  asset: MediaLibrary.Asset,
  assetInfo: MediaLibrary.AssetInfo
): PhotoClassification {
  const mediaSubtypes = (assetInfo as { mediaSubtypes?: string[] }).mediaSubtypes || [];
  const filename = asset.filename || '';

  // Screenshot detection (iOS has reliable mediaSubtype)
  if (mediaSubtypes.includes('screenshot')) {
    return 'screenshot';
  }

  // Camera-specific subtypes (100% from device camera)
  const cameraSubtypes = ['livePhoto', 'photoHDR', 'photoPanorama', 'depthEffect'];
  if (mediaSubtypes.some((st) => cameraSubtypes.includes(st))) {
    return 'camera';
  }

  // Check filename patterns
  if (isScreenshotByFilename(filename)) {
    return 'screenshot';
  }

  if (isDownloadedByFilename(filename) || isNeverCameraFormat(filename)) {
    return 'downloaded';
  }

  // Check for Apple camera EXIF
  const exif = assetInfo.exif as Record<string, unknown> | undefined;
  const exifKeys = exif ? Object.keys(exif) : [];
  const hasAppleExif = exifKeys.some((key) => key.includes('MakerApple'));

  if (hasAppleExif) {
    return 'camera';
  }

  // Check time gap (downloaded photos often have creation/modification gap)
  const creationTime = asset.creationTime || 0;
  const modificationTime = asset.modificationTime || creationTime;
  const timeDiffHours = Math.abs(modificationTime - creationTime) / (1000 * 60 * 60);

  if (timeDiffHours > 24) {
    return 'downloaded';
  }

  return 'other';
}

/**
 * Classify a photo on Android using filename patterns and EXIF
 */
function classifyPhotoAndroid(
  asset: MediaLibrary.Asset,
  assetInfo: MediaLibrary.AssetInfo
): PhotoClassification {
  const filename = asset.filename || assetInfo.filename || '';

  // Screenshot detection by filename
  if (isScreenshotByFilename(filename)) {
    return 'screenshot';
  }

  // Downloaded photo detection by filename
  if (isDownloadedByFilename(filename) || isNeverCameraFormat(filename)) {
    return 'downloaded';
  }

  // Check for camera maker EXIF
  const exif = assetInfo.exif as Record<string, unknown> | undefined;
  if (exif) {
    const makeValue = exif.Make || exif.make || '';
    const hasCameraExif =
      /samsung|google|pixel|xiaomi|oneplus|huawei|oppo|vivo|realme|motorola|lg|sony/i.test(
        String(makeValue)
      );

    if (hasCameraExif) {
      return 'camera';
    }
  }

  // Check time gap
  const creationTime = asset.creationTime || 0;
  const modificationTime = asset.modificationTime || creationTime;
  const timeDiffHours = Math.abs(modificationTime - creationTime) / (1000 * 60 * 60);

  if (timeDiffHours > 24) {
    return 'downloaded';
  }

  // Default to camera for photos without clear signals
  // (most user photos are from camera)
  return 'camera';
}

/**
 * Classify a photo based on platform
 */
function classifyPhoto(
  asset: MediaLibrary.Asset,
  assetInfo: MediaLibrary.AssetInfo
): PhotoClassification {
  if (Platform.OS === 'ios') {
    return classifyPhotoIOS(asset, assetInfo);
  }
  return classifyPhotoAndroid(asset, assetInfo);
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Get start of day timestamp for a date string (local timezone)
 */
function getLocalStartOfDay(dateString: string): number {
  const date = new Date(dateString);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
}

/**
 * Get end of day timestamp for a date string (local timezone)
 */
function getLocalEndOfDay(dateString: string): number {
  const date = new Date(dateString);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  ).getTime();
}

// ============================================================================
// ALBUM FILTERING
// ============================================================================

/**
 * Get asset IDs that belong to excluded albums
 * Returns a Set for O(1) lookup
 */
async function getExcludedAssetIds(
  excludedAlbumIds: string[]
): Promise<Set<string>> {
  if (excludedAlbumIds.length === 0) {
    return new Set();
  }

  const excludedIds = new Set<string>();

  // Query assets from each excluded album
  await Promise.all(
    excludedAlbumIds.map(async (albumId) => {
      try {
        const { assets } = await MediaLibrary.getAssetsAsync({
          album: albumId,
          first: 10000, // Get all assets from excluded album
          mediaType: ['photo', 'video'],
        });

        assets.forEach((asset) => excludedIds.add(asset.id));
      } catch (error) {
        console.warn(`Failed to get assets from excluded album ${albumId}:`, error);
      }
    })
  );

  return excludedIds;
}

// ============================================================================
// MAIN LOADING FUNCTION
// ============================================================================

/**
 * Load photos from the media library with filtering and classification
 *
 * This is the main entry point for the photo filtering system.
 * It handles:
 * - Date range filtering
 * - Excluded album filtering (completely hides those photos)
 * - Platform-specific classification (screenshot, downloaded, camera)
 * - Batched asset info loading for performance
 */
export async function loadPhotosWithFiltering(
  options: LoadPhotosOptions
): Promise<FilterResult> {
  const {
    startDate,
    endDate,
    excludedAlbumIds,
    pageSize = DEFAULT_PAGE_SIZE,
    after,
  } = options;

  const startTimestamp = getLocalStartOfDay(startDate);
  const endTimestamp = getLocalEndOfDay(endDate);

  // Get excluded asset IDs first (for filtering)
  const excludedAssetIds = await getExcludedAssetIds(excludedAlbumIds);

  // Query camera roll
  const queryOptions: MediaLibrary.AssetsOptions = {
    mediaType: ['photo', 'video'],
    createdAfter: startTimestamp,
    createdBefore: endTimestamp,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]], // Newest first
    first: pageSize,
  };

  if (after) {
    queryOptions.after = after;
  }

  const { assets, hasNextPage, endCursor } =
    await MediaLibrary.getAssetsAsync(queryOptions);

  // Filter out excluded album assets
  const includedAssets = assets.filter(
    (asset) => !excludedAssetIds.has(asset.id)
  );

  // Process assets in batches for performance
  const filteredPhotos: FilteredPhoto[] = [];
  const stats: PhotoFilterStats = {
    total: 0,
    camera: 0,
    screenshots: 0,
    downloads: 0,
    other: 0,
    excludedByAlbum: assets.length - includedAssets.length,
  };

  // Process in batches
  for (let i = 0; i < includedAssets.length; i += ASSET_INFO_BATCH_SIZE) {
    const batch = includedAssets.slice(i, i + ASSET_INFO_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (asset) => {
        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
          const classification = classifyPhoto(asset, assetInfo);

          const photo: FilteredPhoto = {
            id: asset.id,
            uri: asset.uri,
            localUri: assetInfo.localUri || asset.uri,
            type: asset.mediaType === 'video' ? 'video' : 'image',
            width: asset.width,
            height: asset.height,
            duration: asset.duration,
            creationTime: asset.creationTime,
            classification,
            filename: asset.filename || '',
          };

          return photo;
        } catch (error) {
          console.warn(`Failed to get asset info for ${asset.id}:`, error);
          return null;
        }
      })
    );

    // Add successful results
    batchResults.forEach((photo) => {
      if (photo) {
        filteredPhotos.push(photo);
        stats.total++;

        switch (photo.classification) {
          case 'camera':
            stats.camera++;
            break;
          case 'screenshot':
            stats.screenshots++;
            break;
          case 'downloaded':
            stats.downloads++;
            break;
          case 'other':
            stats.other++;
            break;
        }
      }
    });
  }

  return {
    photos: filteredPhotos,
    stats,
    hasMore: hasNextPage,
    endCursor: endCursor,
  };
}

// ============================================================================
// SELECTION HELPERS
// ============================================================================

/**
 * Get IDs of photos that should be pre-selected
 * (camera photos and "other" - excludes screenshots and downloads)
 */
export function getPreSelectedIds(photos: FilteredPhoto[]): string[] {
  return photos
    .filter(
      (p) => p.classification === 'camera' || p.classification === 'other'
    )
    .map((p) => p.id);
}

/**
 * Get photos that are "hidden" (not pre-selected)
 * These are screenshots and downloads
 */
export function getHiddenPhotos(photos: FilteredPhoto[]): FilteredPhoto[] {
  return photos.filter(
    (p) => p.classification === 'screenshot' || p.classification === 'downloaded'
  );
}

/**
 * Get photos that are "visible" (pre-selected by default)
 * These are camera photos and other
 */
export function getVisiblePhotos(photos: FilteredPhoto[]): FilteredPhoto[] {
  return photos.filter(
    (p) => p.classification === 'camera' || p.classification === 'other'
  );
}

/**
 * Update selection based on toggling a photo
 */
export function togglePhotoSelection(
  selectedIds: string[],
  photoId: string
): string[] {
  if (selectedIds.includes(photoId)) {
    return selectedIds.filter((id) => id !== photoId);
  }
  return [...selectedIds, photoId];
}

/**
 * Select all photos of a specific classification
 */
export function selectAllByClassification(
  photos: FilteredPhoto[],
  selectedIds: string[],
  classification: PhotoClassification
): string[] {
  const idsToAdd = photos
    .filter((p) => p.classification === classification)
    .map((p) => p.id);

  return [...new Set([...selectedIds, ...idsToAdd])];
}

/**
 * Deselect all photos of a specific classification
 */
export function deselectAllByClassification(
  photos: FilteredPhoto[],
  selectedIds: string[],
  classification: PhotoClassification
): string[] {
  const idsToRemove = new Set(
    photos.filter((p) => p.classification === classification).map((p) => p.id)
  );

  return selectedIds.filter((id) => !idsToRemove.has(id));
}
