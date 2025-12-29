/**
 * Invites API
 *
 * Functions for creating and validating invite codes.
 */

import { supabase } from '@/lib/supabase';
import type {
  ApiResponse,
  ApiListResponse,
  InviteCode,
  InviteValidationResult,
  JoinWorldResult,
} from '@/lib/database.types';

/**
 * Create a new invite code for a world
 * Uses the database function which generates a unique code with 3-day expiry
 */
export async function createInviteCode(
  worldId: string
): Promise<ApiResponse<{ code: string; expires_at: string }>> {
  const { data, error } = await supabase
    .rpc('create_invite_code', { p_world_id: worldId });
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  // RPC returns an array, get first item
  const result = Array.isArray(data) ? data[0] : data;
  return { data: result as { code: string; expires_at: string }, error: null };
}

/**
 * Validate an invite code and get world info
 */
export async function validateInviteCode(
  code: string
): Promise<ApiResponse<InviteValidationResult>> {
  const { data, error } = await supabase
    .rpc('validate_invite_code', { p_code: code.toUpperCase() });
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  // RPC returns an array, get first item
  const result = Array.isArray(data) ? data[0] : data;
  return { data: result as InviteValidationResult, error: null };
}

/**
 * Join a world using an invite code
 */
export async function joinWorldWithCode(
  code: string
): Promise<ApiResponse<JoinWorldResult>> {
  const { data, error } = await supabase
    .rpc('join_world_with_code', { p_code: code.toUpperCase() });
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  // RPC returns an array, get first item
  const result = Array.isArray(data) ? data[0] : data;
  return { data: result as JoinWorldResult, error: null };
}

/**
 * Get all invite codes for a world (owner only)
 */
export async function getWorldInviteCodes(
  worldId: string
): Promise<ApiListResponse<InviteCode>> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('world_id', worldId)
    .order('created_at', { ascending: false });
  
  if (error) {
    return { data: [], error: error.message };
  }
  
  return { data: (data || []) as InviteCode[], error: null };
}

/**
 * Get active (non-expired) invite codes for a world
 */
export async function getActiveInviteCodes(
  worldId: string
): Promise<ApiListResponse<InviteCode>> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('world_id', worldId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    return { data: [], error: error.message };
  }
  
  return { data: (data || []) as InviteCode[], error: null };
}

/**
 * Delete an invite code
 */
export async function deleteInviteCode(codeId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('invite_codes')
    .delete()
    .eq('id', codeId);
  
  if (error) {
    return { data: null, error: error.message };
  }
  
  return { data: null, error: null };
}

/**
 * Generate the full invite URL for a code
 */
export function getInviteUrl(code: string): string {
  return `https://worlding.app/join/${code}`;
}

/**
 * Check if an invite code is expired
 */
export function isCodeExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Get time remaining until code expires
 */
export function getTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  
  if (diff <= 0) {
    return 'Expired';
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h left`;
  }
  
  if (hours > 0) {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m left`;
  }
  
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m left`;
}
