/**
 * Media API
 *
 * Functions for uploading and managing photos/videos in worlds.
 */

import { supabase } from '@/lib/supabase';
import type {
  ApiResponse,
  ApiListResponse,
  Media,
  MediaInsert,
  MediaWithOwner,
  Profile,
} from '@/lib/database.types';
import { hasStorageSpace } from '@/lib/database.types';
import { compressImage } from '@/lib/media-utils';
import { getCurrentProfile } from './profiles';

/**
 * Get all media in a world
 */
export async function getWorldMedia(
  worldId: string
): Promise<ApiListResponse<MediaWithOwner>> {
  const { data, error } = await supabase
    .from('media')
    .select(`
      *,
      owner:profiles(*)
    `)
    .eq('world_id', worldId)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  
  if (error) {
    return { data: [], error: error.message };
  }
  
  const mediaWithOwner: MediaWithOwner[] = (data || []).map((item: any) => ({
    ...item,
    owner: item.owner as Profile,
  }));
  
  return { data: mediaWithOwner, error: null };
}

/**
 * Get media for a specific user in a world
 */
export async function getUserMediaInWorld(
  worldId: string,
  userId: string
): Promise<ApiListResponse<Media>> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('world_id', worldId)
    .eq('owner_id', userId)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  
  if (error) {
    return { data: [], error: error.message };
  }
  
  return { data: (data || []) as Media[], error: null };
}

/**
 * Upload a single media file to a world
 */
export async function uploadMedia(
  worldId: string,
  uri: string,
  options: {
    type: 'image' | 'video';
    width?: number;
    height?: number;
    duration?: number;
    takenAt?: string;
  }
): Promise<ApiResponse<Media>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }
  
  let finalUri = uri;
  let finalWidth = options.width;
  let finalHeight = options.height;

  // Compress images before upload
  if (options.type === 'image' && options.width && options.height) {
    try {
      const compressed = await compressImage(uri, options.width, options.height);
      finalUri = compressed.uri;
      finalWidth = compressed.width;
      finalHeight = compressed.height;
    } catch (e) {
      console.warn('Image compression failed, uploading original:', e);
      // Continue with original if compression fails
    }
  }

  // Fetch the file
  const response = await fetch(finalUri);
  const blob = await response.blob();
  const fileSize = blob.size;
  
  // Check storage limit
  const profileResult = await getCurrentProfile();
  if (profileResult.error || !profileResult.data) {
    return { data: null, error: 'Could not verify storage limit' };
  }
  
  if (!hasStorageSpace(profileResult.data, fileSize)) {
    return { data: null, error: 'Storage limit exceeded. Delete some files or upgrade your plan.' };
  }
  
  // Generate file path
  const extension = options.type === 'video' ? 'mp4' : 'jpg';
  const fileName = `${Date.now()}.${extension}`;
  const filePath = `${worldId}/${user.id}/${fileName}`;
  
  // Upload to storage
  const contentType = options.type === 'video' ? 'video/mp4' : 'image/jpeg';
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, blob, {
      contentType,
      upsert: false,
    });
  
  if (uploadError) {
    return { data: null, error: uploadError.message };
  }
  
  // Create media record
  const mediaInsert: MediaInsert = {
    world_id: worldId,
    owner_id: user.id,
    type: options.type,
    storage_path: filePath,
    width: finalWidth ?? null,
    height: finalHeight ?? null,
    file_size: fileSize,
    duration: options.duration ?? null,
    taken_at: options.takenAt ?? null,
  };
  
  const { data, error } = await supabase
    .from('media')
    .insert(mediaInsert)
    .select()
    .single();
  
  if (error) {
    // Cleanup uploaded file
    await supabase.storage.from('media').remove([filePath]);
    return { data: null, error: error.message };
  }
  
  return { data: data as Media, error: null };
}

/**
 * Upload multiple media files to a world
 */
export async function uploadMultipleMedia(
  worldId: string,
  files: Array<{
    uri: string;
    type: 'image' | 'video';
    width?: number;
    height?: number;
    duration?: number;
    takenAt?: string;
  }>,
  onProgress?: (completed: number, total: number) => void
): Promise<{ successful: Media[]; failed: Array<{ uri: string; error: string }> }> {
  const successful: Media[] = [];
  const failed: Array<{ uri: string; error: string }> = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await uploadMedia(worldId, file.uri, {
      type: file.type,
      width: file.width,
      height: file.height,
      duration: file.duration,
      takenAt: file.takenAt,
    });
    
    if (result.error || !result.data) {
      failed.push({ uri: file.uri, error: result.error || 'Unknown error' });
    } else {
      successful.push(result.data);
    }
    
    onProgress?.(i + 1, files.length);
  }
  
  return { successful, failed };
}

/**
 * Delete a media file
 */
export async function deleteMedia(mediaId: string): Promise<ApiResponse<null>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }
  
  // Get the media record to find storage path
  const { data: media, error: fetchError } = await supabase
    .from('media')
    .select('*')
    .eq('id', mediaId)
    .single();
  
  if (fetchError) {
    return { data: null, error: fetchError.message };
  }
  
  // Check ownership
  if ((media as Media).owner_id !== user.id) {
    return { data: null, error: 'You can only delete your own media' };
  }
  
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('media')
    .remove([(media as Media).storage_path]);
  
  if (storageError) {
    console.warn('Failed to delete file from storage:', storageError.message);
    // Continue with database deletion anyway
  }
  
  // Delete thumbnail if exists
  if ((media as Media).thumbnail_path) {
    await supabase.storage
      .from('media')
      .remove([(media as Media).thumbnail_path!]);
  }
  
  // Delete from database
  const { error } = await supabase
    .from('media')
    .delete()
    .eq('id', mediaId);
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data: null, error: null };
}

/**
 * Get signed URL for a media file (for private bucket access)
 */
export async function getMediaUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<ApiResponse<string>> {
  const { data, error } = await supabase.storage
    .from('media')
    .createSignedUrl(storagePath, expiresIn);
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data: data.signedUrl, error: null };
}

/**
 * Get signed URLs for multiple media files
 */
export async function getMediaUrls(
  storagePaths: string[],
  expiresIn: number = 3600
): Promise<ApiResponse<Record<string, string>>> {
  const { data, error } = await supabase.storage
    .from('media')
    .createSignedUrls(storagePaths, expiresIn);
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  const urlMap: Record<string, string> = {};
  data.forEach((item) => {
    if (item.signedUrl && item.path) {
      urlMap[item.path] = item.signedUrl;
    }
  });
  
  return { data: urlMap, error: null };
}
