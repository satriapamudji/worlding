/**
 * Worlds API
 *
 * Functions for managing worlds (shared photo collections).
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  ApiResponse,
  ApiListResponse,
  World,
  WorldUpdate,
  WorldWithDetails,
  Profile,
  WorldMemberWithProfile,
} from '@/lib/database.types';
import { inferContentTypeAndExtension, readFileAsUint8Array } from '@/lib/file-utils';
import { getCurrentProfile } from './profiles';

/**
 * Get all worlds the current user is a member of
 */
export async function getMyWorlds(): Promise<ApiListResponse<WorldWithDetails>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: [], error: 'Not authenticated' };
  }
  
  // Get worlds with creator and members
  const { data: worlds, error } = await supabase
    .from('worlds')
    .select(`
      *,
      creator:profiles!created_by(*),
      world_members(
        *,
        profile:profiles(*)
      )
    `)
    .order('created_at', { ascending: false });
  
  if (error) {
    return { data: [], error: error.message };
  }
  
  // Transform the data to match our types
  const worldsWithDetails: WorldWithDetails[] = (worlds || []).map((world) => {
    const members: WorldMemberWithProfile[] = (world.world_members || []).map((member: any) => ({
      ...member,
      profile: member.profile,
    }));
    
    return {
      ...world,
      creator: world.creator as Profile,
      members,
      media_count: members.reduce((sum: number, m: WorldMemberWithProfile) => sum + m.photo_count, 0),
    };
  });
  
  return { data: worldsWithDetails, error: null };
}

/**
 * Get a single world by ID with full details
 */
export async function getWorld(worldId: string): Promise<ApiResponse<WorldWithDetails>> {
  const { data: world, error } = await supabase
    .from('worlds')
    .select(`
      *,
      creator:profiles!created_by(*),
      world_members(
        *,
        profile:profiles(*)
      )
    `)
    .eq('id', worldId)
    .single();
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  const members: WorldMemberWithProfile[] = (world.world_members || []).map((member: any) => ({
    ...member,
    profile: member.profile,
  }));
  
  const worldWithDetails: WorldWithDetails = {
    ...world,
    creator: world.creator as Profile,
    members,
    media_count: members.reduce((sum, m) => sum + m.photo_count, 0),
  };
  
  return { data: worldWithDetails, error: null };
}

/**
 * Create a new world
 * Also creates the creator as an owner member
 */
export async function createWorld(
  title: string,
  startDate: string,
  endDate: string,
  coverUri?: string | null
): Promise<ApiResponse<World>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }

  let coverUrl: string | null = null;
  let coverSize = 0;
  let coverPath: string | null = null;

  // Upload cover image if provided
  if (coverUri) {
    const timestamp = Date.now();
    const fileBody = await readFileAsUint8Array(coverUri);
    coverSize = fileBody.length;
    const { contentType, extension } = inferContentTypeAndExtension(coverUri, 'image/jpeg');
    const filePath = `${user.id}/${timestamp}.${extension}`;
    coverPath = filePath;

    const { error: uploadError } = await supabase.storage
      .from('world-covers')
      .upload(filePath, fileBody, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      logger.world.warn('Failed to upload cover', { error: uploadError.message });
      coverSize = 0; // Reset since upload failed
      // Continue without cover - not a fatal error
    } else {
      const { data: urlData } = supabase.storage
        .from('world-covers')
        .getPublicUrl(filePath);
      coverUrl = urlData.publicUrl;
    }
  }
  
  const { data, error: worldError } = await supabase
    .rpc('create_world', {
      title,
      start_date: startDate,
      end_date: endDate,
      cover_url: coverUrl,
    });

  if (worldError) {
    if (coverPath) {
      await supabase.storage.from('world-covers').remove([coverPath]);
    }

    const message = worldError.message ?? 'Failed to create world';
    if (message.includes('subscription_required')) {
      return { data: null, error: 'subscription_required' };
    }

    return { data: null, error: message };
  }

  // RPC returns an array, get first item
  const world = (Array.isArray(data) ? data[0] : data) as World;

  // Update storage used for cover image
  if (coverSize > 0) {
    const profileResult = await getCurrentProfile();
    if (profileResult.data) {
      await supabase
        .from('profiles')
        .update({ storage_used: profileResult.data.storage_used + coverSize })
        .eq('id', user.id);
    }
  }

  return { data: world, error: null };
}

/**
 * Update a world (owner only)
 */
export async function updateWorld(
  worldId: string,
  updates: WorldUpdate
): Promise<ApiResponse<World>> {
  const { data, error } = await supabase
    .from('worlds')
    .update(updates)
    .eq('id', worldId)
    .select()
    .single();
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data, error: null };
}

/**
 * Archive a world
 */
export async function archiveWorld(worldId: string): Promise<ApiResponse<World>> {
  return updateWorld(worldId, {
    state: 'archived',
    archived_at: new Date().toISOString(),
  });
}

/**
 * Delete a world (owner only)
 */
export async function deleteWorld(worldId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('worlds')
    .delete()
    .eq('id', worldId);
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data: null, error: null };
}

/**
 * Update world cover image
 */
export async function updateWorldCover(
  worldId: string,
  coverUri: string
): Promise<ApiResponse<string>> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }

  // Get current profile for storage tracking
  const profileResult = await getCurrentProfile();
  if (profileResult.error || !profileResult.data) {
    return { data: null, error: 'Could not verify storage limit' };
  }

  const timestamp = Date.now();
  const fileBody = await readFileAsUint8Array(coverUri);
  const fileSize = fileBody.length;
  const { contentType, extension } = inferContentTypeAndExtension(coverUri, 'image/jpeg');
  const filePath = `${worldId}/${timestamp}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('world-covers')
    .upload(filePath, fileBody, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  const { data: urlData } = supabase.storage
    .from('world-covers')
    .getPublicUrl(filePath);

  // Update world with new cover URL
  const { error: updateError } = await supabase
    .from('worlds')
    .update({ cover_url: urlData.publicUrl })
    .eq('id', worldId);

  if (updateError) {
    return { data: null, error: updateError.message };
  }

  // Update storage used (add new cover size - we don't track old cover for simplicity)
  await supabase
    .from('profiles')
    .update({ storage_used: profileResult.data.storage_used + fileSize })
    .eq('id', user.id);

  return { data: urlData.publicUrl, error: null };
}
