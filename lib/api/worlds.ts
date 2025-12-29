/**
 * Worlds API
 *
 * Functions for managing worlds (shared photo collections).
 */

import { supabase } from '@/lib/supabase';
import type {
  ApiResponse,
  ApiListResponse,
  World,
  WorldInsert,
  WorldUpdate,
  WorldWithDetails,
  Profile,
  WorldMemberWithProfile,
} from '@/lib/database.types';

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
  
  // Upload cover image if provided
  if (coverUri) {
    const fileName = `${Date.now()}.jpg`;
    const filePath = `${user.id}/${fileName}`;
    
    const response = await fetch(coverUri);
    const blob = await response.blob();
    
    const { error: uploadError } = await supabase.storage
      .from('world-covers')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (uploadError) {
      console.warn('Failed to upload cover:', uploadError.message);
      // Continue without cover - not a fatal error
    } else {
      const { data: urlData } = supabase.storage
        .from('world-covers')
        .getPublicUrl(filePath);
      coverUrl = urlData.publicUrl;
    }
  }
  
  // Create the world
  const worldInsert: WorldInsert = {
    title,
    start_date: startDate,
    end_date: endDate,
    cover_url: coverUrl,
    created_by: user.id,
  };
  
  const { data: world, error: worldError } = await supabase
    .from('worlds')
    .insert(worldInsert)
    .select()
    .single();
  
  if (worldError) {
    return { data: null, error: worldError.message };
  }
  
  // Add creator as owner member
  const { error: memberError } = await supabase
    .from('world_members')
    .insert({
      world_id: world.id,
      user_id: user.id,
      role: 'owner',
      sync_status: 'pending',
    });
  
  if (memberError) {
    // Rollback world creation
    await supabase.from('worlds').delete().eq('id', world.id);
    return { data: null, error: memberError.message };
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
  
  const fileName = `${Date.now()}.jpg`;
  const filePath = `${worldId}/${fileName}`;
  
  const response = await fetch(coverUri);
  const blob = await response.blob();
  
  const { error: uploadError } = await supabase.storage
    .from('world-covers')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
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
  
  return { data: urlData.publicUrl, error: null };
}
