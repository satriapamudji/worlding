-- ============================================================================
-- FIX RLS POLICIES
-- ============================================================================
-- Fixes the chicken-and-egg problem where creating a world fails because
-- the user can't SELECT the world before being added to world_members.
--
-- Also adds missing UPDATE policy for media table.

-- ----------------------------------------------------------------------------
-- FIX: WORLDS SELECT POLICY
-- ----------------------------------------------------------------------------
-- The issue: When creating a world with .insert().select(), the SELECT
-- portion checks RLS policies. The old policy only allowed viewing if
-- the user was in world_members, but we haven't added them yet.
--
-- Fix: Also allow SELECT if the user is the creator (created_by).

DROP POLICY IF EXISTS "Members can view their worlds" ON worlds;
CREATE POLICY "Members can view their worlds"
  ON worlds FOR SELECT
  USING (
    -- Creator can always view their worlds
    created_by = auth.uid()
    OR
    -- Members can view worlds they belong to
    EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = worlds.id
      AND world_members.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- ADD: MEDIA UPDATE POLICY
-- ----------------------------------------------------------------------------
-- Users should be able to update their own media (e.g., to set preview_path)

DROP POLICY IF EXISTS "Users can update own media" ON media;
CREATE POLICY "Users can update own media"
  ON media FOR UPDATE
  USING (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- FIX: INVITE_CODES UPDATE POLICY
-- ----------------------------------------------------------------------------
-- Anyone who uses an invite code needs to increment use_count.
-- The SECURITY DEFINER function handles this, but let's make the policy
-- more permissive for the function to work correctly.
--
-- Actually, the join_world_with_code() function is SECURITY DEFINER,
-- so it bypasses RLS. The current policy is fine.

-- ----------------------------------------------------------------------------
-- FIX: WORLD_MEMBERS VIEW POLICY
-- ----------------------------------------------------------------------------
-- Same issue as worlds - when joining via invite code, the user needs to
-- be able to see the world_members after being added, but the policy
-- requires existing membership.
--
-- Fix: Allow viewing your own membership record.

DROP POLICY IF EXISTS "Members can view world members" ON world_members;
CREATE POLICY "Members can view world members"
  ON world_members FOR SELECT
  USING (
    -- Can view your own membership
    user_id = auth.uid()
    OR
    -- Can view members of worlds you belong to
    EXISTS (
      SELECT 1 FROM world_members AS my_membership
      WHERE my_membership.world_id = world_members.world_id
      AND my_membership.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STORAGE BUCKET POLICIES
-- ============================================================================
-- These need to be set up in the Supabase Dashboard under Storage > Policies.
--
-- For 'avatars' bucket (PUBLIC):
--   SELECT: Allow all (bucket is public)
--   INSERT: Allow authenticated users to upload to their own folder
--           Expression: (auth.uid()::text = (storage.foldername(name))[1])
--   UPDATE: Allow users to update their own files
--           Expression: (auth.uid()::text = (storage.foldername(name))[1])
--   DELETE: Allow users to delete their own files
--           Expression: (auth.uid()::text = (storage.foldername(name))[1])
--
-- For 'world-covers' bucket (PUBLIC):
--   SELECT: Allow all (bucket is public)
--   INSERT: Allow authenticated users to upload
--           Expression: (auth.role() = 'authenticated')
--   UPDATE: Allow authenticated users
--           Expression: (auth.role() = 'authenticated')
--   DELETE: Allow users who uploaded (world owner check is complex, allow broad for now)
--           Expression: (auth.role() = 'authenticated')
--
-- For 'media' bucket (PRIVATE):
--   SELECT: Allow members of the world to view
--           This requires a function to check world membership from the path
--   INSERT: Allow members to upload to their world folders
--   UPDATE: Allow users to update their own media
--   DELETE: Allow users to delete their own media
--
-- Since storage policies can be complex and bucket-path dependent,
-- here's a simpler approach that works for most cases:

-- Helper function to check if user is a member of a world
-- (Used by storage policies for the media bucket)
CREATE OR REPLACE FUNCTION is_world_member(p_world_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM world_members
    WHERE world_members.world_id = p_world_id
    AND world_members.user_id = auth.uid()
  );
END;
$$;

-- ============================================================================
-- DONE!
-- ============================================================================
--
-- After running this migration, go to Supabase Dashboard > Storage and
-- set up policies for each bucket:
--
-- AVATARS (public bucket):
--   - Anyone can read (public)
--   - Authenticated users can upload to uid/ folder
--
-- WORLD-COVERS (public bucket):
--   - Anyone can read (public)
--   - Authenticated users can upload
--
-- MEDIA (private bucket):
--   - World members can read files in worldId/ folder
--   - World members can upload to worldId/ folder
--   - Users can delete their own files
