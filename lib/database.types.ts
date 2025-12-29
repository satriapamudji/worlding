/**
 * Database Types for Supabase
 *
 * These types match the schema defined in supabase/migrations/001_initial_schema.sql
 * Keep these in sync with your database schema.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type WorldState = 'active' | 'building' | 'archived';
export type MemberRole = 'owner' | 'member';
export type SyncStatus = 'pending' | 'syncing' | 'synced';
export type MediaType = 'image' | 'video';

// ============================================================================
// TABLE TYPES
// ============================================================================

/**
 * Profile - User display info + storage tracking
 * Extends Supabase auth.users
 */
export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  storage_used: number;
  storage_limit: number;
  created_at: string;
  updated_at: string;
}

/**
 * World - A shared photo collection for an event/trip
 */
export interface World {
  id: string;
  title: string;
  cover_url: string | null;
  start_date: string;
  end_date: string;
  state: WorldState;
  created_by: string;
  created_at: string;
  archived_at: string | null;
}

/**
 * WorldMember - Junction table for users belonging to worlds
 */
export interface WorldMember {
  id: string;
  world_id: string;
  user_id: string;
  role: MemberRole;
  sync_status: SyncStatus;
  photo_count: number;
  joined_at: string;
}

/**
 * InviteCode - Shareable codes to join a world
 */
export interface InviteCode {
  id: string;
  code: string;
  world_id: string;
  created_by: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  created_at: string;
}

/**
 * Media - Photos and videos uploaded to worlds
 */
export interface Media {
  id: string;
  world_id: string;
  owner_id: string;
  type: MediaType;
  storage_path: string;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  file_size: number;
  duration: number | null;
  taken_at: string | null;
  created_at: string;
}

// ============================================================================
// INSERT TYPES (for creating new records)
// ============================================================================

export interface ProfileInsert {
  id: string; // Must match auth.users.id
  name: string;
  avatar_url?: string | null;
}

export interface WorldInsert {
  title: string;
  cover_url?: string | null;
  start_date: string;
  end_date: string;
  state?: WorldState;
  created_by: string;
}

export interface WorldMemberInsert {
  world_id: string;
  user_id: string;
  role?: MemberRole;
  sync_status?: SyncStatus;
}

export interface InviteCodeInsert {
  code: string;
  world_id: string;
  created_by: string;
  expires_at: string;
  max_uses?: number | null;
}

export interface MediaInsert {
  world_id: string;
  owner_id: string;
  type: MediaType;
  storage_path: string;
  thumbnail_path?: string | null;
  width?: number | null;
  height?: number | null;
  file_size: number;
  duration?: number | null;
  taken_at?: string | null;
}

// ============================================================================
// UPDATE TYPES (for updating records)
// ============================================================================

export interface ProfileUpdate {
  name?: string;
  avatar_url?: string | null;
}

export interface WorldUpdate {
  title?: string;
  cover_url?: string | null;
  start_date?: string;
  end_date?: string;
  state?: WorldState;
  archived_at?: string | null;
}

export interface WorldMemberUpdate {
  sync_status?: SyncStatus;
  photo_count?: number;
}

// ============================================================================
// JOINED/ENRICHED TYPES
// ============================================================================

/**
 * World with creator profile and member info
 */
export interface WorldWithDetails extends World {
  creator: Profile;
  members: WorldMemberWithProfile[];
  media_count: number;
}

/**
 * World member with profile info
 */
export interface WorldMemberWithProfile extends WorldMember {
  profile: Profile;
}

/**
 * Media with owner profile
 */
export interface MediaWithOwner extends Media {
  owner: Profile;
}

/**
 * Invite code validation result
 */
export interface InviteValidationResult {
  valid: boolean;
  world_id: string | null;
  world_title: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
  member_count: number | null;
  error_message: string | null;
}

/**
 * Join world result
 */
export interface JoinWorldResult {
  success: boolean;
  world_id: string | null;
  error_message: string | null;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface ApiListResponse<T> {
  data: T[];
  error: string | null;
}

// ============================================================================
// STORAGE TYPES
// ============================================================================

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
}

export interface StorageInfo {
  used: number;
  limit: number;
  percentage: number;
  formatted: {
    used: string;
    limit: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Calculate storage info from profile
 */
export function getStorageInfo(profile: Profile): StorageInfo {
  const percentage = Math.round((profile.storage_used / profile.storage_limit) * 100);
  return {
    used: profile.storage_used,
    limit: profile.storage_limit,
    percentage: Math.min(percentage, 100),
    formatted: {
      used: formatBytes(profile.storage_used),
      limit: formatBytes(profile.storage_limit),
    },
  };
}

/**
 * Check if user has enough storage for a file
 */
export function hasStorageSpace(profile: Profile, fileSize: number): boolean {
  return profile.storage_used + fileSize <= profile.storage_limit;
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', options);
  
  // Same month
  if (start.getMonth() === end.getMonth()) {
    return `${startStr} - ${end.getDate()}`;
  }
  
  return `${startStr} - ${endStr}`;
}
