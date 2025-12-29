/**
 * Media Utilities
 * 
 * Helper functions for downloading, saving, sharing, and compressing media files.
 */

import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import type { Media, MediaType } from '@/lib/database.types';

// ============================================================================
// COMPRESSION CONSTANTS
// ============================================================================

/** Maximum dimension (width or height) for compressed images */
export const MAX_IMAGE_DIMENSION = 1920;

/** JPEG compression quality (0.0 - 1.0) */
export const IMAGE_COMPRESSION_QUALITY = 0.8;

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

export interface CompressionResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Compress an image by resizing and reducing quality
 * 
 * @param uri - Local file URI of the image
 * @param width - Original width of the image
 * @param height - Original height of the image
 * @returns Compressed image URI with new dimensions
 */
export async function compressImage(
  uri: string,
  width: number,
  height: number
): Promise<CompressionResult> {
  const actions: Array<{ resize: { width?: number; height?: number } }> = [];
  
  let newWidth = width;
  let newHeight = height;

  // Resize if either dimension exceeds max
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
    newWidth = Math.round(width * scale);
    newHeight = Math.round(height * scale);
    
    // Resize maintaining aspect ratio (only specify width, height auto-calculated)
    actions.push({ resize: { width: newWidth } });
  }

  const result = await manipulateAsync(uri, actions, {
    compress: IMAGE_COMPRESSION_QUALITY,
    format: SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * Check if an image needs compression based on dimensions
 */
export function needsCompression(width: number, height: number): boolean {
  return width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION;
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a date for display in media viewer
 */
export function formatMediaDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Get filename from media object
 */
export function getMediaFilename(mediaId: string, type: MediaType): string {
  const extension = type === 'video' ? 'mp4' : 'jpg';
  return `worlding_${mediaId}.${extension}`;
}

/**
 * Download a remote file to local cache
 */
export async function downloadMedia(
  uri: string,
  filename: string
): Promise<File | null> {
  try {
    const file = new File(Paths.cache, filename);
    
    // Use fetch to download and write to file
    const response = await fetch(uri);
    if (!response.ok) {
      console.error('Download failed with status:', response.status);
      return null;
    }
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Write to file
    await file.write(uint8Array);
    
    return file;
  } catch (error) {
    console.error('Error downloading media:', error);
    return null;
  }
}

/**
 * Save media to camera roll
 * @param uri - Pre-resolved signed URL for the media
 * @param mediaId - Media ID for filename generation
 * @param type - Media type (image or video)
 */
export async function saveMediaToCameraRoll(
  uri: string,
  mediaId: string,
  type: MediaType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Request permissions
    const { status } = await MediaLibrary.requestPermissionsAsync();
    
    if (status !== 'granted') {
      return { success: false, error: 'Permission denied' };
    }

    // Download file first if it's a remote URL
    const filename = getMediaFilename(mediaId, type);
    const file = await downloadMedia(uri, filename);
    
    if (!file) {
      return { success: false, error: 'Download failed' };
    }

    // Save to camera roll
    const asset = await MediaLibrary.createAssetAsync(file.uri);
    
    if (asset) {
      // Clean up cached file
      try {
        await file.delete();
      } catch {
        // Ignore cleanup errors
      }
      return { success: true };
    }
    
    return { success: false, error: 'Failed to save to camera roll' };
  } catch (error) {
    console.error('Error saving to camera roll:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Share media using native share sheet
 * @param uri - Pre-resolved signed URL for the media
 * @param mediaId - Media ID for filename generation
 * @param type - Media type (image or video)
 */
export async function shareMedia(
  uri: string,
  mediaId: string,
  type: MediaType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (!isAvailable) {
      return { success: false, error: 'Sharing not available' };
    }

    // Download file first if it's a remote URL
    const filename = getMediaFilename(mediaId, type);
    const file = await downloadMedia(uri, filename);
    
    if (!file) {
      return { success: false, error: 'Download failed' };
    }

    // Share the file
    await Sharing.shareAsync(file.uri, {
      mimeType: type === 'video' ? 'video/mp4' : 'image/jpeg',
      dialogTitle: 'Share from Worlding',
    });

    // Clean up cached file after a delay (share sheet may still be using it)
    setTimeout(async () => {
      try {
        await file.delete();
      } catch {
        // Ignore cleanup errors
      }
    }, 5000);

    return { success: true };
  } catch (error) {
    console.error('Error sharing media:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Check if user is the owner of the media
 */
export function isMediaOwner(media: Media, currentUserId: string): boolean {
  return media.owner_id === currentUserId;
}

/**
 * Delete media - This function is now deprecated.
 * Use deleteMedia from @/lib/api/media instead for real Supabase deletion.
 * @deprecated Use deleteMedia from @/lib/api/media instead
 */
export async function deleteMediaLocal(
  mediaId: string
): Promise<{ success: boolean; error?: string }> {
  // This is kept for backwards compatibility but should not be used
  console.warn('deleteMediaLocal is deprecated. Use deleteMedia from @/lib/api/media instead.');
  console.log('Deleted media:', mediaId);
  return { success: true };
}
