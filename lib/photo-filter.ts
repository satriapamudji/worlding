/**
 * Photo Filtering Utility
 *
 * Cross-platform photo filtering with smart classification for iOS and Android.
 * Handles screenshot detection, download detection, and excluded album filtering.
 */

import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

/** Classification of a photo based on its source */
export type PhotoClassification = 'camera' | 'screenshot' | 'downloaded' | 'other';

/** Source app for social media detection */
export type SocialAppSource = 'snapchat' | 'bereal' | 'tiktok' | 'whatsapp' | 'telegram' | 'instagram' | 'other';

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
  /** The timestamp used for filtering (EXIF DateTimeOriginal if available, otherwise creationTime) */
  effectiveDate: number;
  /** Original EXIF DateTimeOriginal timestamp if available */
  exifDateTimeOriginal?: number;
  /** Whether this photo is in the ±2hr buffer zone (outside exact date range) */
  isBufferPhoto: boolean;
  /** iOS burst identifier for grouping */
  burstIdentifier?: string;
  /** Whether this is the representative photo of a burst (iOS) */
  isRepresentativeAsset?: boolean;
  /** Whether this photo is part of a burst group */
  isBurstMember: boolean;
  /** For Live Photos: the paired MOV file URI */
  livePhotoMovUri?: string;
  /** Whether this is a Live Photo (HEIC with paired MOV) */
  isLivePhoto: boolean;
  /** Video file size in bytes (for size warnings) */
  videoSize?: number;
  /** Detected social app source if downloaded from social media */
  sourceApp?: SocialAppSource;
}

/** Statistics about filtered photos */
export interface PhotoFilterStats {
  total: number;
  camera: number;
  screenshots: number;
  downloads: number;
  other: number;
  excludedByAlbum: number;
  /** Number of photos in the ±2hr buffer zone */
  bufferPhotos: number;
}

/** A group of burst photos */
export interface BurstGroup {
  /** Unique identifier for the burst group */
  burstId: string;
  /** All photos in this burst */
  photos: FilteredPhoto[];
  /** The representative/best photo of the burst */
  representativePhotoId: string;
  /** Number of photos in the burst */
  count: number;
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

/** Maximum photos to load in a single query (load all at once) */
const DEFAULT_PAGE_SIZE = 10000;

/** Buffer zone in milliseconds (±2 hours) */
const DATE_BUFFER_MS = 2 * 60 * 60 * 1000;

/** Timestamp window for Android burst detection (0.5 seconds) */
const BURST_TIMESTAMP_WINDOW_MS = 500;

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
 * Detect if a filename is from a social app and identify the source
 * Returns the detected app or null if not from a social app
 */
function detectSocialAppSource(filename: string): SocialAppSource | null {
  const lower = filename.toLowerCase();

  // Snapchat patterns:
  // - Snapchat-XXXXXXXXXX.jpg
  // - snap-*.jpg
  // - Memories from Snapchat often contain "snapchat" or start with "snap-"
  if (/snapchat|^snap[-_]/i.test(filename)) {
    return 'snapchat';
  }

  // BeReal patterns:
  // - BeReal-YYYY-MM-DD-*.jpg
  // - BeReal_*.jpg
  // - Photos often have "bereal" in filename
  if (/bereal/i.test(filename)) {
    return 'bereal';
  }

  // TikTok patterns:
  // - TikTok-*.mp4
  // - tiktok_*.jpg
  // - snaptik*.mp4 (third-party downloader)
  if (/tiktok|snaptik/i.test(filename)) {
    return 'tiktok';
  }

  // WhatsApp pattern: IMG-YYYYMMDD-WAxxxx
  if (lower.includes('whatsapp') || /img-\d{8}-wa\d+/i.test(filename)) {
    return 'whatsapp';
  }

  // Telegram pattern
  if (lower.includes('telegram')) {
    return 'telegram';
  }

  // Instagram patterns:
  // - Instagram saves often contain "instagram" or "insta"
  // - FB_IMG_* pattern used by Facebook/Instagram
  if (lower.includes('instagram') || lower.includes('insta') || /^fb_img_/i.test(filename)) {
    return 'instagram';
  }

  return null;
}

/**
 * Detect if a filename indicates a downloaded/shared photo
 * (WhatsApp, Telegram, messaging apps, web downloads)
 */
function isDownloadedByFilename(filename: string): boolean {
  const lower = filename.toLowerCase();

  // Check social app patterns first
  if (detectSocialAppSource(filename) !== null) {
    return true;
  }

  // Other messaging apps
  const isMessenger =
    lower.includes('messenger') ||
    lower.includes('signal') ||
    lower.includes('viber');

  // Downloaded from web
  const isWebDownload =
    lower.includes('download') ||
    lower.includes('saved') ||
    lower.includes('received');

  // Other social media saves
  const isSocialMedia =
    lower.includes('twitter') ||
    lower.includes('facebook');

  return isMessenger || isWebDownload || isSocialMedia;
}

/**
 * Social app album names to detect
 */
const SOCIAL_APP_ALBUMS = [
  'whatsapp',
  'whatsapp images',
  'whatsapp video',
  'telegram',
  'telegram images',
  'telegram video',
  'snapchat',
  'instagram',
  'tiktok',
  'bereal',
  'messenger',
  'signal',
  'viber',
  'facebook',
  'twitter',
];

/**
 * Social app path patterns to detect
 */
const SOCIAL_APP_PATH_PATTERNS = [
  /\/whatsapp\//i,
  /\/telegram\//i,
  /\/snapchat\//i,
  /\/instagram\//i,
  /\/tiktok\//i,
  /\/bereal\//i,
  /\/messenger\//i,
  /\/signal\//i,
  /\/viber\//i,
  /\/facebook\//i,
  /\/twitter\//i,
  /\/sent\//i, // Common for messaging apps
  /\/received\//i,
];

/**
 * Detect if a photo is from a social app based on its file path
 */
function isDownloadedByPath(localUri: string): boolean {
  if (!localUri) return false;
  return SOCIAL_APP_PATH_PATTERNS.some((pattern) => pattern.test(localUri));
}

/**
 * Detect social app from file path
 */
function detectSocialAppFromPath(localUri: string): SocialAppSource | null {
  if (!localUri) return null;
  const lower = localUri.toLowerCase();

  if (lower.includes('/whatsapp/')) return 'whatsapp';
  if (lower.includes('/telegram/')) return 'telegram';
  if (lower.includes('/snapchat/')) return 'snapchat';
  if (lower.includes('/instagram/')) return 'instagram';
  if (lower.includes('/tiktok/')) return 'tiktok';
  if (lower.includes('/bereal/')) return 'bereal';

  return null;
}

/**
 * Detect if a photo is downloaded based on missing EXIF metadata.
 *
 * Camera photos have rich EXIF data (Make, Model, DateTimeOriginal, GPS).
 * Social media/messaging apps strip this metadata for privacy.
 *
 * A photo is likely downloaded if it's missing ALL of these key fields:
 * - Make (camera manufacturer like "Apple", "Samsung", "Google")
 * - Model (camera model like "iPhone 15 Pro", "Pixel 8")
 * - DateTimeOriginal (when the photo was actually taken)
 */
function isDownloadedByMetadata(
  exif: Record<string, unknown> | undefined,
  localUri: string
): { isDownloaded: boolean; reason: string } {
  // Also check file path for social app folders
  if (isDownloadedByPath(localUri)) {
    return { isDownloaded: true, reason: 'path_contains_social_app' };
  }

  // No EXIF at all = likely downloaded
  if (!exif || Object.keys(exif).length === 0) {
    return { isDownloaded: true, reason: 'no_exif_data' };
  }

  // Check for camera maker (Make field)
  const make = exif.Make || exif.make;
  const hasMake = make && String(make).trim().length > 0;

  // Check for camera model (Model field)
  const model = exif.Model || exif.model;
  const hasModel = model && String(model).trim().length > 0;

  // Check for DateTimeOriginal (when photo was taken)
  const dateTimeOriginal = exif.DateTimeOriginal || exif.DateTimeDigitized;
  const hasDateTimeOriginal = dateTimeOriginal && String(dateTimeOriginal).trim().length > 0;

  // Check for GPS data
  const hasGPS = !!(exif.GPSLatitude || exif.GPSLongitude || exif.latitude || exif.longitude);

  // If missing ALL camera identifiers, it's likely downloaded
  // Camera photos typically have at least Make + Model
  if (!hasMake && !hasModel) {
    // But if it has DateTimeOriginal or GPS, it might still be from camera
    if (!hasDateTimeOriginal && !hasGPS) {
      return { isDownloaded: true, reason: 'missing_make_model_date_gps' };
    }
  }

  return { isDownloaded: false, reason: 'has_camera_metadata' };
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
 * Classify a photo on iOS using mediaSubtypes and EXIF metadata
 *
 * Key insight: Social apps strip EXIF metadata. So:
 * - Has DateTimeOriginal → camera (social apps strip this)
 * - Has Make/Model → camera
 * - No EXIF at all → downloaded
 */
function classifyPhotoIOS(
  asset: MediaLibrary.Asset,
  assetInfo: MediaLibrary.AssetInfo
): PhotoClassification {
  const mediaSubtypes = (assetInfo as { mediaSubtypes?: string[] }).mediaSubtypes || [];
  const filename = asset.filename || '';
  const localUri = assetInfo.localUri || '';
  const exif = assetInfo.exif as Record<string, unknown> | undefined;

  // Screenshot detection (iOS has reliable mediaSubtype)
  if (mediaSubtypes.includes('screenshot')) {
    return 'screenshot';
  }

  // Check filename patterns for screenshots
  if (isScreenshotByFilename(filename)) {
    return 'screenshot';
  }

  // File formats that are NEVER from camera
  if (isNeverCameraFormat(filename)) {
    return 'downloaded';
  }

  // Check filename patterns for known social apps
  if (isDownloadedByFilename(filename)) {
    return 'downloaded';
  }

  // Check file path for social app folders
  if (isDownloadedByPath(localUri)) {
    return 'downloaded';
  }

  // Camera-specific subtypes (100% from device camera)
  const cameraSubtypes = ['livePhoto', 'photoHDR', 'photoPanorama', 'depthEffect'];
  if (mediaSubtypes.some((st) => cameraSubtypes.includes(st))) {
    return 'camera';
  }

  // *** METADATA-BASED DETECTION ***
  // Social apps strip EXIF. If photo has camera metadata, it's from camera.

  if (exif && Object.keys(exif).length > 0) {
    // Has Apple-specific EXIF → definitely camera
    const exifKeys = Object.keys(exif);
    if (exifKeys.some((key) => key.includes('MakerApple'))) {
      return 'camera';
    }

    // Has DateTimeOriginal → social apps strip this, so it's camera
    const hasDateTimeOriginal = !!(exif.DateTimeOriginal || exif.DateTimeDigitized);
    if (hasDateTimeOriginal) {
      return 'camera';
    }

    // Has Make/Model → it's from a camera
    const hasMake = !!(exif.Make || exif.make);
    const hasModel = !!(exif.Model || exif.model);
    if (hasMake || hasModel) {
      return 'camera';
    }
  }

  // No EXIF at all = likely downloaded (social apps strip metadata)
  if (!exif || Object.keys(exif).length === 0) {
    return 'downloaded';
  }

  // Check time gap (downloaded photos often have creation/modification gap)
  const creationTime = asset.creationTime || 0;
  const modificationTime = asset.modificationTime || creationTime;
  const timeDiffHours = Math.abs(modificationTime - creationTime) / (1000 * 60 * 60);

  if (timeDiffHours > 24) {
    return 'downloaded';
  }

  // Default to camera (safer - most user photos are from camera)
  return 'camera';
}

/**
 * Classify a photo on Android using filename patterns and EXIF metadata
 *
 * Key insight: Social apps strip EXIF metadata. So:
 * - Has DateTimeOriginal → camera (social apps strip this)
 * - Has Make/Model → camera
 * - No EXIF at all → downloaded
 */
function classifyPhotoAndroid(
  asset: MediaLibrary.Asset,
  assetInfo: MediaLibrary.AssetInfo
): PhotoClassification {
  const filename = asset.filename || assetInfo.filename || '';
  const localUri = assetInfo.localUri || '';
  const exif = assetInfo.exif as Record<string, unknown> | undefined;

  // Screenshot detection by filename
  if (isScreenshotByFilename(filename)) {
    return 'screenshot';
  }

  // File formats that are NEVER from camera
  if (isNeverCameraFormat(filename)) {
    return 'downloaded';
  }

  // Check filename patterns for known social apps
  if (isDownloadedByFilename(filename)) {
    return 'downloaded';
  }

  // Check file path for social app folders
  if (isDownloadedByPath(localUri)) {
    return 'downloaded';
  }

  // *** METADATA-BASED DETECTION ***
  // Social apps strip EXIF. If photo has camera metadata, it's from camera.

  if (exif && Object.keys(exif).length > 0) {
    // Has known camera maker → definitely camera
    const makeValue = String(exif.Make || exif.make || '');
    if (/samsung|google|pixel|xiaomi|oneplus|huawei|oppo|vivo|realme|motorola|lg|sony|apple/i.test(makeValue)) {
      return 'camera';
    }

    // Has DateTimeOriginal → social apps strip this, so it's camera
    const hasDateTimeOriginal = !!(exif.DateTimeOriginal || exif.DateTimeDigitized);
    if (hasDateTimeOriginal) {
      return 'camera';
    }

    // Has any Make/Model → it's from a camera
    const hasMake = makeValue.length > 0;
    const hasModel = !!(exif.Model || exif.model);
    if (hasMake || hasModel) {
      return 'camera';
    }
  }

  // No EXIF at all = likely downloaded (social apps strip metadata)
  if (!exif || Object.keys(exif).length === 0) {
    return 'downloaded';
  }

  // Check time gap
  const creationTime = asset.creationTime || 0;
  const modificationTime = asset.modificationTime || creationTime;
  const timeDiffHours = Math.abs(modificationTime - creationTime) / (1000 * 60 * 60);

  if (timeDiffHours > 24) {
    return 'downloaded';
  }

  // Default to camera (safer - most user photos are from camera)
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
// BURST & LIVE PHOTO DETECTION
// ============================================================================

/**
 * Extract burst info from iOS asset
 * Returns burstIdentifier and whether this is the representative photo
 */
function extractIOSBurstInfo(
  assetInfo: MediaLibrary.AssetInfo
): { burstIdentifier?: string; isRepresentative?: boolean } {
  // iOS provides these in the asset info
  const info = assetInfo as unknown as {
    burstIdentifier?: string;
    representsBurst?: boolean;
  };

  return {
    burstIdentifier: info.burstIdentifier,
    isRepresentative: info.representsBurst,
  };
}

/**
 * Detect if a photo is a Live Photo on iOS
 * Live Photos have the 'livePhoto' media subtype
 */
function isLivePhotoIOS(assetInfo: MediaLibrary.AssetInfo): boolean {
  const mediaSubtypes = (assetInfo as { mediaSubtypes?: string[] }).mediaSubtypes || [];
  return mediaSubtypes.includes('livePhoto');
}

/**
 * Group photos into burst groups on iOS using burstIdentifier
 */
export function groupBurstsIOS(photos: FilteredPhoto[]): {
  groupedPhotos: FilteredPhoto[];
  burstGroups: Map<string, BurstGroup>;
} {
  const burstGroups = new Map<string, BurstGroup>();
  const nonBurstPhotos: FilteredPhoto[] = [];
  const photosByBurst = new Map<string, FilteredPhoto[]>();

  // First pass: group photos by burst identifier
  for (const photo of photos) {
    if (photo.burstIdentifier) {
      const existing = photosByBurst.get(photo.burstIdentifier) || [];
      existing.push(photo);
      photosByBurst.set(photo.burstIdentifier, existing);
    } else {
      nonBurstPhotos.push(photo);
    }
  }

  // Second pass: create burst groups for groups with more than 1 photo
  for (const [burstId, burstPhotos] of photosByBurst) {
    if (burstPhotos.length > 1) {
      // Sort by creation time
      burstPhotos.sort((a, b) => a.creationTime - b.creationTime);

      // Find representative photo (or use first if none marked)
      const representative =
        burstPhotos.find((p) => p.isRepresentativeAsset) || burstPhotos[0];

      // Mark all as burst members
      burstPhotos.forEach((p) => {
        p.isBurstMember = true;
      });

      burstGroups.set(burstId, {
        burstId,
        photos: burstPhotos,
        representativePhotoId: representative.id,
        count: burstPhotos.length,
      });
    } else {
      // Single photo with burst ID - not really a burst
      nonBurstPhotos.push(...burstPhotos);
    }
  }

  // Create grouped photos list with burst groups collapsed
  const groupedPhotos: FilteredPhoto[] = [...nonBurstPhotos];

  // Add representative photo for each burst (the group will expand to show all)
  for (const group of burstGroups.values()) {
    const representative = group.photos.find(
      (p) => p.id === group.representativePhotoId
    );
    if (representative) {
      groupedPhotos.push(representative);
    }
  }

  // Sort by effective date (newest first)
  groupedPhotos.sort((a, b) => b.effectiveDate - a.effectiveDate);

  return { groupedPhotos, burstGroups };
}

/**
 * Group photos into burst groups on Android using timestamp clustering
 * Photos taken within 0.5s of each other are considered a burst
 */
export function groupBurstsAndroid(photos: FilteredPhoto[]): {
  groupedPhotos: FilteredPhoto[];
  burstGroups: Map<string, BurstGroup>;
} {
  const burstGroups = new Map<string, BurstGroup>();
  const processedIds = new Set<string>();

  // Sort photos by creation time first
  const sortedPhotos = [...photos].sort(
    (a, b) => a.creationTime - b.creationTime
  );

  const clusters: FilteredPhoto[][] = [];
  let currentCluster: FilteredPhoto[] = [];

  for (const photo of sortedPhotos) {
    if (currentCluster.length === 0) {
      currentCluster.push(photo);
    } else {
      const lastPhoto = currentCluster[currentCluster.length - 1];
      const timeDiff = photo.creationTime - lastPhoto.creationTime;

      if (timeDiff <= BURST_TIMESTAMP_WINDOW_MS) {
        currentCluster.push(photo);
      } else {
        // Start new cluster
        clusters.push(currentCluster);
        currentCluster = [photo];
      }
    }
  }

  // Don't forget the last cluster
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Create burst groups from clusters with more than 1 photo
  let burstIndex = 0;
  for (const cluster of clusters) {
    if (cluster.length > 1) {
      const burstId = `android-burst-${burstIndex++}`;

      // Mark all as burst members and assign burst ID
      cluster.forEach((p) => {
        p.isBurstMember = true;
        p.burstIdentifier = burstId;
      });

      // First photo is representative on Android
      burstGroups.set(burstId, {
        burstId,
        photos: cluster,
        representativePhotoId: cluster[0].id,
        count: cluster.length,
      });

      cluster.forEach((p) => processedIds.add(p.id));
    }
  }

  // Create grouped photos list
  const groupedPhotos: FilteredPhoto[] = [];

  for (const photo of photos) {
    if (!processedIds.has(photo.id)) {
      // Non-burst photo
      groupedPhotos.push(photo);
    }
  }

  // Add representative photo for each burst
  for (const group of burstGroups.values()) {
    const representative = group.photos.find(
      (p) => p.id === group.representativePhotoId
    );
    if (representative) {
      groupedPhotos.push(representative);
    }
  }

  // Sort by effective date (newest first)
  groupedPhotos.sort((a, b) => b.effectiveDate - a.effectiveDate);

  return { groupedPhotos, burstGroups };
}

/**
 * Group photos into bursts (platform-specific)
 */
export function groupBursts(photos: FilteredPhoto[]): {
  groupedPhotos: FilteredPhoto[];
  burstGroups: Map<string, BurstGroup>;
} {
  if (Platform.OS === 'ios') {
    return groupBurstsIOS(photos);
  }
  return groupBurstsAndroid(photos);
}

/**
 * Pair Live Photos (HEIC with MOV)
 * Returns photos with livePhotoMovUri populated and MOV files filtered out
 */
export function pairLivePhotos(photos: FilteredPhoto[]): FilteredPhoto[] {
  // Only applicable on iOS
  if (Platform.OS !== 'ios') {
    return photos;
  }

  // Build a map of base filenames to photos
  const photosByBasename = new Map<string, FilteredPhoto>();
  const movFiles = new Map<string, FilteredPhoto>();

  for (const photo of photos) {
    const filename = photo.filename.toLowerCase();
    const extension = filename.split('.').pop() || '';
    const basename = filename.slice(0, -(extension.length + 1)); // Remove .ext

    if (extension === 'mov' && photo.type === 'video') {
      movFiles.set(basename, photo);
    } else if (photo.isLivePhoto) {
      photosByBasename.set(basename, photo);
    }
  }

  // Pair HEIC Live Photos with their MOV counterparts
  const pairedMovIds = new Set<string>();

  for (const [basename, livePhoto] of photosByBasename) {
    const movFile = movFiles.get(basename);
    if (movFile) {
      livePhoto.livePhotoMovUri = movFile.localUri || movFile.uri;
      pairedMovIds.add(movFile.id);
    }
  }

  // Filter out paired MOV files from the result
  return photos.filter((p) => !pairedMovIds.has(p.id));
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Parse EXIF date string to timestamp
 * EXIF dates are typically in format "YYYY:MM:DD HH:MM:SS"
 */
function parseExifDate(exifDate: string): number | null {
  if (!exifDate || typeof exifDate !== 'string') {
    return null;
  }

  // Handle EXIF format: "YYYY:MM:DD HH:MM:SS"
  const exifMatch = exifDate.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (exifMatch) {
    const [, year, month, day, hour, minute, second] = exifMatch;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1, // JS months are 0-indexed
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  // Try ISO format as fallback
  const isoDate = new Date(exifDate);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.getTime();
  }

  return null;
}

/**
 * Extract the effective date for a photo, preferring EXIF DateTimeOriginal
 * Falls back to asset creationTime if EXIF not available
 */
function getPhotoEffectiveDate(
  asset: MediaLibrary.Asset,
  assetInfo: MediaLibrary.AssetInfo
): { effectiveDate: number; exifDateTimeOriginal?: number } {
  const exif = assetInfo.exif as Record<string, unknown> | undefined;

  if (exif) {
    // Try DateTimeOriginal first (when photo was actually taken)
    const dateTimeOriginal = exif.DateTimeOriginal || exif.DateTimeDigitized;
    if (dateTimeOriginal) {
      const parsed = parseExifDate(String(dateTimeOriginal));
      if (parsed) {
        return {
          effectiveDate: parsed,
          exifDateTimeOriginal: parsed,
        };
      }
    }

    // Try CreateDate as fallback
    const createDate = exif.CreateDate || exif.DateCreated;
    if (createDate) {
      const parsed = parseExifDate(String(createDate));
      if (parsed) {
        return {
          effectiveDate: parsed,
          exifDateTimeOriginal: parsed,
        };
      }
    }
  }

  // Fall back to asset creationTime
  return {
    effectiveDate: asset.creationTime,
    exifDateTimeOriginal: undefined,
  };
}

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
        logger.photos.warn('Failed to get assets from excluded album', { albumId, error });
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
 * - Date range filtering with ±2hr buffer zone
 * - EXIF DateTimeOriginal priority for accurate photo dates
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

  // Exact date range boundaries
  const startTimestamp = getLocalStartOfDay(startDate);
  const endTimestamp = getLocalEndOfDay(endDate);

  // Expanded query range (±2hr buffer) to catch photos near boundaries
  // We'll filter by EXIF date after loading
  const queryStartWithBuffer = startTimestamp - DATE_BUFFER_MS;
  const queryEndWithBuffer = endTimestamp + DATE_BUFFER_MS;

  // Get excluded asset IDs first (for filtering)
  const excludedAssetIds = await getExcludedAssetIds(excludedAlbumIds);

  // Query camera roll with expanded date range
  const queryOptions: MediaLibrary.AssetsOptions = {
    mediaType: ['photo', 'video'],
    createdAfter: queryStartWithBuffer,
    createdBefore: queryEndWithBuffer,
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
    bufferPhotos: 0,
  };

  // Process in batches
  for (let i = 0; i < includedAssets.length; i += ASSET_INFO_BATCH_SIZE) {
    const batch = includedAssets.slice(i, i + ASSET_INFO_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (asset) => {
        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
          const classification = classifyPhoto(asset, assetInfo);

          // Get effective date (preferring EXIF DateTimeOriginal)
          const { effectiveDate, exifDateTimeOriginal } = getPhotoEffectiveDate(
            asset,
            assetInfo
          );

          // Check if photo is in exact range or buffer zone
          const isInExactRange =
            effectiveDate >= startTimestamp && effectiveDate <= endTimestamp;
          const isInBufferZone =
            !isInExactRange &&
            effectiveDate >= queryStartWithBuffer &&
            effectiveDate <= queryEndWithBuffer;

          // Skip photos completely outside the buffer range
          if (!isInExactRange && !isInBufferZone) {
            return null;
          }

          // Detect social app source for downloaded photos
          const filename = asset.filename || '';
          const sourceApp = detectSocialAppSource(filename) || undefined;

          // Get video file size for size warnings
          let videoSize: number | undefined;
          if (asset.mediaType === 'video') {
            // Estimate video size from duration (rough estimate: ~1MB per 10s for compressed video)
            // Real size would require file system access
            videoSize = asset.duration ? Math.round(asset.duration * 100000) : undefined;
          }

          // Extract burst info (iOS only has native burst identifiers)
          const burstInfo = Platform.OS === 'ios'
            ? extractIOSBurstInfo(assetInfo)
            : { burstIdentifier: undefined, isRepresentative: undefined };

          // Detect Live Photos (iOS only)
          const isLivePhoto = Platform.OS === 'ios' && isLivePhotoIOS(assetInfo);

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
            filename,
            // New fields
            effectiveDate,
            exifDateTimeOriginal,
            isBufferPhoto: isInBufferZone,
            // Burst fields (isBurstMember will be set by groupBursts())
            burstIdentifier: burstInfo.burstIdentifier,
            isRepresentativeAsset: burstInfo.isRepresentative,
            isBurstMember: false,
            // Live Photo fields
            isLivePhoto,
            livePhotoMovUri: undefined, // Will be set by pairLivePhotos()
            videoSize,
            sourceApp,
          };

          return photo;
        } catch (error) {
          logger.photos.warn('Failed to get asset info', { assetId: asset.id, error });
          return null;
        }
      })
    );

    // Add successful results
    batchResults.forEach((photo) => {
      if (photo) {
        // Debug logging for photo classification (only log non-camera photos to reduce noise)
        if (photo.classification !== 'camera') {
          logger.photos.debug('Non-camera photo', {
            filename: photo.filename,
            classification: photo.classification,
          });
        }

        filteredPhotos.push(photo);
        stats.total++;

        // Track buffer photos
        if (photo.isBufferPhoto) {
          stats.bufferPhotos++;
        }

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

/**
 * Get photos that are in the buffer zone (±2hr outside exact date range)
 */
export function getBufferPhotos(photos: FilteredPhoto[]): FilteredPhoto[] {
  return photos.filter((p) => p.isBufferPhoto);
}

/**
 * Get photos that are NOT in the buffer zone (within exact date range)
 */
export function getNonBufferPhotos(photos: FilteredPhoto[]): FilteredPhoto[] {
  return photos.filter((p) => !p.isBufferPhoto);
}

/**
 * Get IDs of buffer photos for styling (e.g., reduced opacity)
 */
export function getBufferPhotoIds(photos: FilteredPhoto[]): Set<string> {
  return new Set(photos.filter((p) => p.isBufferPhoto).map((p) => p.id));
}

/**
 * Get videos from photos for size calculation
 */
export function getVideos(photos: FilteredPhoto[]): FilteredPhoto[] {
  return photos.filter((p) => p.type === 'video');
}

/**
 * Calculate total video size for selected videos
 */
export function calculateTotalVideoSize(
  photos: FilteredPhoto[],
  selectedIds: Set<string>
): number {
  return photos
    .filter((p) => p.type === 'video' && selectedIds.has(p.id))
    .reduce((total, p) => total + (p.videoSize || 0), 0);
}

/**
 * Check if a filename is from a social app (exported for use elsewhere)
 */
export { detectSocialAppSource };
