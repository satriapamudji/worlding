/**
 * Media API
 *
 * Functions for uploading and managing photos/videos in worlds.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  ApiResponse,
  ApiListResponse,
  Media,
  MediaInsert,
  MediaWithOwner,
  Profile,
} from '@/lib/database.types';
import { hasStorageSpace } from '@/lib/database.types';
import { compressImage, compressRelivePreview } from '@/lib/media-utils';
import { inferContentTypeAndExtension, readFileAsUint8Array } from '@/lib/file-utils';
import { getCurrentProfile } from './profiles';

type SignedUrlCacheEntry = {
  signedUrl: string;
  expiresAtMs: number;
};

const signedUrlCache = new Map<string, SignedUrlCacheEntry>();

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

  let previewUri: string | null = null;
  let previewSize = 0;

  // Compress images before upload
  if (options.type === 'image' && options.width && options.height) {
    try {
      const compressed = await compressImage(uri, options.width, options.height);
      finalUri = compressed.uri;
      finalWidth = compressed.width;
      finalHeight = compressed.height;

      const preview = await compressRelivePreview(uri, options.width, options.height);
      previewUri = preview.uri;
    } catch (e) {
      logger.media.warn('Image compression failed, uploading original', e);
      previewUri = null;
      // Continue with original if compression fails
    }
  }

  const fileBody = await readFileAsUint8Array(finalUri);
  const fileSize = fileBody.length;

  if (previewUri) {
    try {
      const previewBody = await readFileAsUint8Array(previewUri);
      previewSize = previewBody.length;
    } catch {
      previewSize = 0;
    }
  }
  
  // Check storage limit (original + preview)
  const profileResult = await getCurrentProfile();
  if (profileResult.error || !profileResult.data) {
    return { data: null, error: 'Could not verify storage limit' };
  }
  
  if (!hasStorageSpace(profileResult.data, fileSize + previewSize)) {
    return { data: null, error: 'Storage limit exceeded. Delete some files or upgrade your plan.' };
  }
  
  // Generate file paths
  const timestamp = Date.now();
  const fallbackType = options.type === 'video' ? 'video/mp4' : 'image/jpeg';
  const { contentType, extension } = inferContentTypeAndExtension(finalUri, fallbackType);
  const fileName = `${timestamp}.${extension}`;
  const filePath = `${worldId}/${user.id}/${fileName}`;

  const previewPath = previewUri ? `${worldId}/${user.id}/${timestamp}_preview.jpg` : null;

  // Upload original to storage
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, fileBody, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  // Upload preview (best-effort); if it fails we still keep original
  if (previewUri && previewPath) {
    try {
      const previewBody = await readFileAsUint8Array(previewUri);

      const { error: previewUploadError } = await supabase.storage
        .from('media')
        .upload(previewPath, previewBody, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (previewUploadError) {
        previewSize = 0;
      }
    } catch {
      previewSize = 0;
    }
  }

  // Create media record
  const mediaInsert: MediaInsert = {
    world_id: worldId,
    owner_id: user.id,
    type: options.type,
    storage_path: filePath,
    preview_path: previewSize > 0 ? previewPath : null,
    preview_size: previewSize,
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
    // Cleanup uploaded files
    const cleanupPaths = [filePath];
    if (previewSize > 0 && previewPath) cleanupPaths.push(previewPath);

    await supabase.storage.from('media').remove(cleanupPaths);
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
    logger.media.warn('Failed to delete file from storage', { path: (media as Media).storage_path, error: storageError.message });
    // Continue with database deletion anyway
  }
  
  // Delete thumbnail if exists
  if ((media as Media).thumbnail_path) {
    await supabase.storage
      .from('media')
      .remove([(media as Media).thumbnail_path!]);
  }

  // Delete preview if exists
  if ((media as Media).preview_path) {
    await supabase.storage
      .from('media')
      .remove([(media as Media).preview_path!]);
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
  const nowMs = Date.now();

  const urlMap: Record<string, string> = {};
  const uniquePaths = Array.from(new Set(storagePaths));

  const uncachedPaths: string[] = [];
  uniquePaths.forEach((path) => {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAtMs > nowMs + 60_000) {
      urlMap[path] = cached.signedUrl;
    } else {
      uncachedPaths.push(path);
    }
  });

  if (uncachedPaths.length === 0) {
    return { data: urlMap, error: null };
  }

  const { data, error } = await supabase.storage
    .from('media')
    .createSignedUrls(uncachedPaths, expiresIn);

  if (error) {
    return { data: null, error: error.message };
  }

  const expiresAtMs = nowMs + expiresIn * 1000;

  data.forEach((item) => {
    if (item.signedUrl && item.path) {
      urlMap[item.path] = item.signedUrl;
      signedUrlCache.set(item.path, {
        signedUrl: item.signedUrl,
        expiresAtMs,
      });
    }
  });

  return { data: urlMap, error: null };
}
