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
  
  // Create file path: avatars/{user_id}/{timestamp}.jpg
  const fileName = `${Date.now()}.jpg`;
  const filePath = `${user.id}/${fileName}`;
  
  // Fetch the image as blob
  const response = await fetch(uri);
  const blob = await response.blob();
  
  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  
  if (uploadError) {
    return { data: null, error: uploadError.message };
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);
  
  // Update profile with new avatar URL
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', user.id);
  
  if (updateError) {
    return { data: null, error: updateError.message };
  }
  
  return { data: urlData.publicUrl, error: null };
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
