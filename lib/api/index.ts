/**
 * API Layer
 *
 * Barrel export for all API functions.
 */

// Profiles
export {
  calculateLiveStorageUsed,
  createProfile,
  getCurrentProfile,
  getProfile,
  getStorageUsage,
  incrementStorageUsed,
  isStorageSyncStale,
  profileExists,
  syncStorageIfStale,
  syncStorageUsed,
  updateProfile,
  uploadAvatar,
} from './profiles';

// Worlds
export {
  archiveWorld,
  createWorld,
  deleteWorld,
  getMyWorlds,
  getWorld,
  updateWorld,
  updateWorldCover,
} from './worlds';

// Members
export {
  getMyMembership,
  getWorldMembers,
  isMember,
  isOwner,
  leaveWorld,
  removeMember,
  updateMyMembership,
  updateSyncStatus,
} from './members';

// Invites
export {
  createInviteCode,
  deleteInviteCode,
  getActiveInviteCodes,
  getInviteUrl,
  getTimeRemaining,
  getWorldInviteCodes,
  isCodeExpired,
  joinWorldWithCode,
  validateInviteCode,
} from './invites';

// Media
export {
  deleteMedia,
  getMediaUrl,
  getMediaUrls,
  getUserMediaInWorld,
  getWorldMedia,
  uploadMedia,
  uploadMultipleMedia,
} from './media';

// Re-export types
export type {
  ApiListResponse,
  ApiResponse,
  AnalyticsEvent,
  Entitlement,
  InviteCode,
  InviteValidationResult,
  JoinWorldResult,
  Media,
  MediaInsert,
  MediaType,
  MediaWithOwner,
  MemberRole,
  Profile,
  ProfileInsert,
  ProfileUpdate,
  StorageInfo,
  SyncStatus,
  World,
  WorldInsert,
  WorldMember,
  WorldMemberInsert,
  WorldMemberUpdate,
  WorldMemberWithProfile,
  WorldState,
  WorldUpdate,
  WorldWithDetails,
} from '@/lib/database.types';

// Re-export helpers
export {
  formatBytes,
  formatDateRange,
  getStorageInfo,
  hasStorageSpace,
} from '@/lib/database.types';
