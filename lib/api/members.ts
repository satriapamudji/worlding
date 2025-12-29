/**
 * Members API
 *
 * Functions for managing world membership.
 */

import { supabase } from '@/lib/supabase';
import type {
  ApiResponse,
  ApiListResponse,
  WorldMember,
  WorldMemberUpdate,
  WorldMemberWithProfile,
} from '@/lib/database.types';

/**
 * Get all members of a world
 */
export async function getWorldMembers(
  worldId: string
): Promise<ApiListResponse<WorldMemberWithProfile>> {
  const { data, error } = await supabase
    .from('world_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('world_id', worldId)
    .order('joined_at', { ascending: true });
  
  if (error) {
    return { data: [], error: error.message };
  }
  
  const members: WorldMemberWithProfile[] = (data || []).map((member: any) => ({
    ...member,
    profile: member.profile,
  }));
  
  return { data: members, error: null };
}

/**
 * Get current user's membership in a world
 */
export async function getMyMembership(
  worldId: string
): Promise<ApiResponse<WorldMember>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase
    .from('world_members')
    .select('*')
    .eq('world_id', worldId)
    .eq('user_id', user.id)
    .single();
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data, error: null };
}

/**
 * Check if current user is a member of a world
 */
export async function isMember(worldId: string): Promise<boolean> {
  const result = await getMyMembership(worldId);
  return !!result.data;
}

/**
 * Check if current user is an owner of a world
 */
export async function isOwner(worldId: string): Promise<boolean> {
  const result = await getMyMembership(worldId);
  return result.data?.role === 'owner';
}

/**
 * Update current user's membership (e.g., sync status)
 */
export async function updateMyMembership(
  worldId: string,
  updates: WorldMemberUpdate
): Promise<ApiResponse<WorldMember>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase
    .from('world_members')
    .update(updates)
    .eq('world_id', worldId)
    .eq('user_id', user.id)
    .select()
    .single();
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data, error: null };
}

/**
 * Update sync status for current user in a world
 */
export async function updateSyncStatus(
  worldId: string,
  status: 'pending' | 'syncing' | 'synced'
): Promise<ApiResponse<WorldMember>> {
  return updateMyMembership(worldId, { sync_status: status });
}

/**
 * Leave a world
 */
export async function leaveWorld(worldId: string): Promise<ApiResponse<null>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }
  
  // Check if user is the owner
  const membership = await getMyMembership(worldId);
  if (membership.data?.role === 'owner') {
    return { data: null, error: 'Owners cannot leave. Transfer ownership or delete the world.' };
  }
  
  const { error } = await supabase
    .from('world_members')
    .delete()
    .eq('world_id', worldId)
    .eq('user_id', user.id);
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data: null, error: null };
}

/**
 * Remove a member from a world (owner only)
 */
export async function removeMember(
  worldId: string,
  userId: string
): Promise<ApiResponse<null>> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'Not authenticated' };
  }
  
  // Check if current user is owner
  const amOwner = await isOwner(worldId);
  if (!amOwner) {
    return { data: null, error: 'Only owners can remove members' };
  }
  
  // Cannot remove yourself
  if (userId === user.id) {
    return { data: null, error: 'Cannot remove yourself. Use leaveWorld instead.' };
  }
  
  const { error } = await supabase
    .from('world_members')
    .delete()
    .eq('world_id', worldId)
    .eq('user_id', userId);
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data: null, error: null };
}
