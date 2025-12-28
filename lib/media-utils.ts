/**
 * Media Utilities
 * 
 * Helper functions for downloading, saving, and sharing media files.
 */

import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import type { Photo } from '@/constants/mockData';

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
export function getMediaFilename(media: Photo): string {
  const extension = media.type === 'video' ? 'mp4' : 'jpg';
  return `worlding_${media.id}.${extension}`;
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
 */
export async function saveMediaToCameraRoll(
  media: Photo
): Promise<{ success: boolean; error?: string }> {
  try {
    // Request permissions
    const { status } = await MediaLibrary.requestPermissionsAsync();
    
    if (status !== 'granted') {
      return { success: false, error: 'Permission denied' };
    }

    // Download file first if it's a remote URL
    const filename = getMediaFilename(media);
    const file = await downloadMedia(media.uri, filename);
    
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
 */
export async function shareMedia(
  media: Photo
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (!isAvailable) {
      return { success: false, error: 'Sharing not available' };
    }

    // Download file first if it's a remote URL
    const filename = getMediaFilename(media);
    const file = await downloadMedia(media.uri, filename);
    
    if (!file) {
      return { success: false, error: 'Download failed' };
    }

    // Share the file
    await Sharing.shareAsync(file.uri, {
      mimeType: media.type === 'video' ? 'video/mp4' : 'image/jpeg',
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
export function isMediaOwner(media: Photo, currentUserId: string): boolean {
  return media.owner.id === currentUserId;
}

/**
 * Delete media (mock implementation - returns success)
 * In production, this would call the backend API
 */
export async function deleteMedia(
  media: Photo
): Promise<{ success: boolean; error?: string }> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock: always succeed
  // In production, this would call Supabase or your backend
  console.log('Deleted media:', media.id);
  return { success: true };
}
