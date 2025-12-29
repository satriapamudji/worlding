/**
 * Profile API
 *
 * Functions for managing user profiles.
 */

import { supabase } from '@/lib/supabase';
import type {
  ApiResponse,
  Profile,
  ProfileInsert,
  ProfileUpdate,
  StorageInfo,
} from '@/lib/database.types';
import { getStorageInfo } from '@/lib/database.types';
import { inferContentTypeAndExtension, readFileAsUint8Array } from '@/lib/file-utils';

/**
 * Get the current user's profile
 */
export async function getCurrentProfile(): Promise<ApiResponse<Profile>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (error) {
    // Profile doesn't exist yet (user needs onboarding)
    if (error.code === 'PGRST116') {
      return { data: null, error: 'no_profile' };
    }
    return { data: null, error: error.message };
  }
  
  return { data, error: null };
}

/**
 * Get a profile by user ID
 */
export async function getProfile(userId: string): Promise<ApiResponse<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data, error: null };
}

/**
 * Create a new profile (called during onboarding)
 */
export async function createProfile(profile: ProfileInsert): Promise<ApiResponse<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single();
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data, error: null };
}

/**
 * Update the current user's profile
 */
export async function updateProfile(updates: ProfileUpdate): Promise<ApiResponse<Profile>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data, error: null };
}

/**
 * Upload an avatar image and update profile
 */
export async function uploadAvatar(uri: string): Promise<ApiResponse<string>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }

  // Get current profile for storage tracking
  const profileResult = await getCurrentProfile();
  if (profileResult.error || !profileResult.data) {
    return { data: null, error: 'Could not verify storage limit' };
  }

  // Fixed path so we overwrite the same object each time
  const filePath = `${user.id}/avatar`;
  const fileBody = await readFileAsUint8Array(uri);
  const fileSize = fileBody.length;

  const { contentType } = inferContentTypeAndExtension(uri, 'image/jpeg');

  // Try to get old avatar size to subtract (best effort)
  let oldAvatarSize = 0;
  try {
    const { data: files } = await supabase.storage
      .from('avatars')
      .list(user.id, { limit: 1, search: 'avatar' });
    if (files && files.length > 0 && files[0].metadata?.size) {
      oldAvatarSize = files[0].metadata.size;
    }
  } catch {
    // Ignore - old avatar size unknown
  }

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, fileBody, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);
  const separator = urlData.publicUrl.includes('?') ? '&' : '?';
  const cacheBustedUrl = `${urlData.publicUrl}${separator}v=${Date.now()}`;

  // Update profile with new avatar URL and storage used
  const newStorageUsed = Math.max(0, profileResult.data.storage_used - oldAvatarSize + fileSize);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      avatar_url: cacheBustedUrl,
      storage_used: newStorageUsed,
    })
    .eq('id', user.id);

  if (updateError) {
    return { data: null, error: updateError.message };
  }

  return { data: cacheBustedUrl, error: null };
}

/**
 * Get current user's storage info
 */
export async function getStorageUsage(): Promise<ApiResponse<StorageInfo>> {
  const profileResult = await getCurrentProfile();
  
  if (profileResult.error || !profileResult.data) {
    return { data: null, error: profileResult.error };
  }
  
  return { data: getStorageInfo(profileResult.data), error: null };
}

/**
 * Check if profile exists for current user
 */
export async function profileExists(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  return !error && !!data;
}

// Storage sync cache
const STORAGE_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastStorageSyncAt: number | null = null;

/**
 * Check if storage needs a full sync (stale cache)
 */
export function isStorageSyncStale(): boolean {
  if (!lastStorageSyncAt) return true;
  return Date.now() - lastStorageSyncAt > STORAGE_SYNC_INTERVAL_MS;
}

/**
 * Increment storage used by a delta (for immediate feedback after uploads)
 * This avoids a full recalculation on every upload
 */
export async function incrementStorageUsed(deltaBytes: number): Promise<ApiResponse<number>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }

  const profileResult = await getCurrentProfile();
  if (profileResult.error || !profileResult.data) {
    return { data: null, error: profileResult.error };
  }

  const newStorageUsed = Math.max(0, profileResult.data.storage_used + deltaBytes);

  const { error } = await supabase
    .from('profiles')
    .update({ storage_used: newStorageUsed })
    .eq('id', user.id);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: newStorageUsed, error: null };
}

/**
 * Calculate actual storage used by querying storage buckets
 * More accurate than the cached counter, but slower
 */
export async function calculateLiveStorageUsed(): Promise<ApiResponse<number>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }

  let totalBytes = 0;

  // 1. Avatars: avatars/{user_id}/*
  try {
    const { data: avatarFiles } = await supabase.storage
      .from('avatars')
      .list(user.id);
    if (avatarFiles) {
      for (const file of avatarFiles) {
        if (file.metadata?.size) {
          totalBytes += file.metadata.size;
        }
      }
    }
  } catch {
    // Bucket may not exist or be empty
  }

  // 2. World covers: world-covers/{user_id}/*
  try {
    const { data: coverFiles } = await supabase.storage
      .from('world-covers')
      .list(user.id);
    if (coverFiles) {
      for (const file of coverFiles) {
        if (file.metadata?.size) {
          totalBytes += file.metadata.size;
        }
      }
    }
  } catch {
    // Bucket may not exist or be empty
  }

  // 3. Media: Get all worlds user is in, then list their media
  try {
    const { data: memberships } = await supabase
      .from('world_members')
      .select('world_id')
      .eq('user_id', user.id);

    if (memberships) {
      for (const membership of memberships) {
        const userMediaPath = `${membership.world_id}/${user.id}`;
        const { data: mediaFiles } = await supabase.storage
          .from('media')
          .list(userMediaPath);
        if (mediaFiles) {
          for (const file of mediaFiles) {
            if (file.metadata?.size) {
              totalBytes += file.metadata.size;
            }
          }
        }
      }
    }
  } catch {
    // May fail if no media bucket or no files
  }

  return { data: totalBytes, error: null };
}

/**
 * Sync storage_used with actual storage (recalculate and save)
 * Updates the cache timestamp after successful sync
 */
export async function syncStorageUsed(): Promise<ApiResponse<number>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }

  const liveResult = await calculateLiveStorageUsed();
  if (liveResult.error || liveResult.data === null) {
    return { data: null, error: liveResult.error };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ storage_used: liveResult.data })
    .eq('id', user.id);

  if (error) {
    return { data: null, error: error.message };
  }

  // Mark cache as fresh
  lastStorageSyncAt = Date.now();

  return { data: liveResult.data, error: null };
}

/**
 * Smart storage sync - only syncs if cache is stale
 * Use this for routine checks (e.g., on profile load)
 */
export async function syncStorageIfStale(): Promise<ApiResponse<number | null>> {
  if (!isStorageSyncStale()) {
    // Cache is fresh, return current value from profile
    const profileResult = await getCurrentProfile();
    return { data: profileResult.data?.storage_used ?? null, error: null };
  }
  return syncStorageUsed();
}
