-- ============================================================================
-- WORLDING DATABASE SCHEMA
-- ============================================================================
-- 
-- HOW TO USE:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- 
-- MANUAL STEPS AFTER RUNNING SQL:
-- 1. Go to Storage → Create bucket "avatars" (Public)
-- 2. Go to Storage → Create bucket "world-covers" (Public)  
-- 3. Go to Storage → Create bucket "media" (Private)
--
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES
-- Extends Supabase auth.users with app-specific user data
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  storage_used BIGINT NOT NULL DEFAULT 0,           -- bytes used
  storage_limit BIGINT NOT NULL DEFAULT 524288000,  -- 500 MB in bytes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up profiles by ID (already primary key, but explicit)
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- ----------------------------------------------------------------------------
-- WORLDS
-- A shared photo collection for an event/trip
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worlds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  cover_url TEXT,                                   -- Storage path or URL
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  state TEXT NOT NULL DEFAULT 'active'              -- active, building, archived
    CHECK (state IN ('active', 'building', 'archived')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Index for fetching worlds by creator
CREATE INDEX IF NOT EXISTS idx_worlds_created_by ON worlds(created_by);

-- Index for fetching worlds by state
CREATE INDEX IF NOT EXISTS idx_worlds_state ON worlds(state);

-- ----------------------------------------------------------------------------
-- WORLD_MEMBERS
-- Junction table for users belonging to worlds
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS world_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'               -- owner, member
    CHECK (role IN ('owner', 'member')),
  sync_status TEXT NOT NULL DEFAULT 'pending'       -- pending, syncing, synced
    CHECK (sync_status IN ('pending', 'syncing', 'synced')),
  photo_count INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only be in a world once
  UNIQUE(world_id, user_id)
);

-- Index for fetching members of a world
CREATE INDEX IF NOT EXISTS idx_world_members_world_id ON world_members(world_id);

-- Index for fetching worlds a user belongs to
CREATE INDEX IF NOT EXISTS idx_world_members_user_id ON world_members(user_id);

-- ----------------------------------------------------------------------------
-- INVITE_CODES
-- Shareable codes to join a world
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,                        -- e.g., 'A7X92B'
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INT,                                     -- NULL = unlimited
  use_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up codes
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

-- Index for fetching codes by world
CREATE INDEX IF NOT EXISTS idx_invite_codes_world_id ON invite_codes(world_id);

-- ----------------------------------------------------------------------------
-- MEDIA
-- Photos and videos uploaded to worlds
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL                                -- image, video
    CHECK (type IN ('image', 'video')),
  storage_path TEXT NOT NULL,                       -- Path in Supabase Storage
  thumbnail_path TEXT,                              -- For videos
  width INT,
  height INT,
  file_size BIGINT NOT NULL DEFAULT 0,              -- bytes, for storage tracking
  duration INT,                                     -- Video duration in seconds
  taken_at TIMESTAMPTZ,                             -- Original photo timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching media by world
CREATE INDEX IF NOT EXISTS idx_media_world_id ON media(world_id);

-- Index for fetching media by owner
CREATE INDEX IF NOT EXISTS idx_media_owner_id ON media(owner_id);

-- Index for sorting by taken_at
CREATE INDEX IF NOT EXISTS idx_media_taken_at ON media(taken_at);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Generate a unique 6-character alphanumeric invite code
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed ambiguous: 0,O,1,I
  result TEXT := '';
  i INT;
BEGIN
  -- Generate 6 random characters
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  -- Check if code already exists, regenerate if so
  WHILE EXISTS (SELECT 1 FROM invite_codes WHERE code = result) LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
  END LOOP;
  
  RETURN result;
END;
$$;

-- ----------------------------------------------------------------------------
-- Update updated_at timestamp on row modification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Increment user storage when media is inserted
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_storage_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET storage_used = storage_used + NEW.file_size
  WHERE id = NEW.owner_id;
  
  -- Also increment photo_count for the world member
  UPDATE world_members
  SET photo_count = photo_count + 1
  WHERE world_id = NEW.world_id AND user_id = NEW.owner_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_media_insert ON media;
CREATE TRIGGER on_media_insert
  AFTER INSERT ON media
  FOR EACH ROW
  EXECUTE FUNCTION increment_storage_used();

-- ----------------------------------------------------------------------------
-- Decrement user storage when media is deleted
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decrement_storage_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET storage_used = GREATEST(0, storage_used - OLD.file_size)
  WHERE id = OLD.owner_id;
  
  -- Also decrement photo_count for the world member
  UPDATE world_members
  SET photo_count = GREATEST(0, photo_count - 1)
  WHERE world_id = OLD.world_id AND user_id = OLD.owner_id;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_media_delete ON media;
CREATE TRIGGER on_media_delete
  AFTER DELETE ON media
  FOR EACH ROW
  EXECUTE FUNCTION decrement_storage_used();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------

-- Anyone can view any profile (for showing member names/avatars)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update only their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- WORLDS POLICIES
-- ----------------------------------------------------------------------------

-- Users can only see worlds they are a member of
DROP POLICY IF EXISTS "Members can view their worlds" ON worlds;
CREATE POLICY "Members can view their worlds"
  ON worlds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = worlds.id
      AND world_members.user_id = auth.uid()
    )
  );

-- Authenticated users can create worlds
DROP POLICY IF EXISTS "Authenticated users can create worlds" ON worlds;
CREATE POLICY "Authenticated users can create worlds"
  ON worlds FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only the creator (owner) can update a world
DROP POLICY IF EXISTS "Owners can update their worlds" ON worlds;
CREATE POLICY "Owners can update their worlds"
  ON worlds FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = worlds.id
      AND world_members.user_id = auth.uid()
      AND world_members.role = 'owner'
    )
  );

-- Only the creator (owner) can delete a world
DROP POLICY IF EXISTS "Owners can delete their worlds" ON worlds;
CREATE POLICY "Owners can delete their worlds"
  ON worlds FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = worlds.id
      AND world_members.user_id = auth.uid()
      AND world_members.role = 'owner'
    )
  );

-- ----------------------------------------------------------------------------
-- WORLD_MEMBERS POLICIES
-- ----------------------------------------------------------------------------

-- Members can see other members in their worlds
DROP POLICY IF EXISTS "Members can view world members" ON world_members;
CREATE POLICY "Members can view world members"
  ON world_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM world_members AS my_membership
      WHERE my_membership.world_id = world_members.world_id
      AND my_membership.user_id = auth.uid()
    )
  );

-- Users can insert themselves as members (for joining via invite)
DROP POLICY IF EXISTS "Users can join worlds" ON world_members;
CREATE POLICY "Users can join worlds"
  ON world_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own membership (e.g., sync_status)
DROP POLICY IF EXISTS "Users can update own membership" ON world_members;
CREATE POLICY "Users can update own membership"
  ON world_members FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can leave worlds (delete their own membership)
DROP POLICY IF EXISTS "Users can leave worlds" ON world_members;
CREATE POLICY "Users can leave worlds"
  ON world_members FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- INVITE_CODES POLICIES
-- ----------------------------------------------------------------------------

-- Anyone can read invite codes (needed for validation)
DROP POLICY IF EXISTS "Anyone can read invite codes" ON invite_codes;
CREATE POLICY "Anyone can read invite codes"
  ON invite_codes FOR SELECT
  USING (true);

-- Only world owners can create invite codes
DROP POLICY IF EXISTS "World owners can create invite codes" ON invite_codes;
CREATE POLICY "World owners can create invite codes"
  ON invite_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = invite_codes.world_id
      AND world_members.user_id = auth.uid()
      AND world_members.role = 'owner'
    )
  );

-- Only world owners can update invite codes (e.g., increment use_count)
DROP POLICY IF EXISTS "World owners can update invite codes" ON invite_codes;
CREATE POLICY "World owners can update invite codes"
  ON invite_codes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = invite_codes.world_id
      AND world_members.user_id = auth.uid()
      AND world_members.role = 'owner'
    )
  );

-- Only world owners can delete invite codes
DROP POLICY IF EXISTS "World owners can delete invite codes" ON invite_codes;
CREATE POLICY "World owners can delete invite codes"
  ON invite_codes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = invite_codes.world_id
      AND world_members.user_id = auth.uid()
      AND world_members.role = 'owner'
    )
  );

-- ----------------------------------------------------------------------------
-- MEDIA POLICIES
-- ----------------------------------------------------------------------------

-- Members can view media in their worlds
DROP POLICY IF EXISTS "Members can view world media" ON media;
CREATE POLICY "Members can view world media"
  ON media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = media.world_id
      AND world_members.user_id = auth.uid()
    )
  );

-- Members can upload media to their worlds
DROP POLICY IF EXISTS "Members can upload media" ON media;
CREATE POLICY "Members can upload media"
  ON media FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM world_members
      WHERE world_members.world_id = media.world_id
      AND world_members.user_id = auth.uid()
    )
  );

-- Users can only delete their own media
DROP POLICY IF EXISTS "Users can delete own media" ON media;
CREATE POLICY "Users can delete own media"
  ON media FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================================================
-- STORAGE BUCKET POLICIES (Run these separately in SQL Editor)
-- ============================================================================

-- Note: Storage buckets must be created manually in Dashboard → Storage
-- After creating buckets, run these policies:

-- AVATARS BUCKET (Public)
-- INSERT policy exists check (run only if policy doesn't exist):
DO $$
BEGIN
  -- Check if storage schema exists (it should in Supabase)
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    -- Avatars: Users can upload to their own folder
    INSERT INTO storage.policies (name, bucket_id, operation, definition)
    SELECT 
      'Users can upload own avatar',
      'avatars',
      'INSERT',
      '(auth.uid()::text = (storage.foldername(name))[1])'
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.policies 
      WHERE bucket_id = 'avatars' AND name = 'Users can upload own avatar'
    );
    
    -- Avatars: Anyone can view
    INSERT INTO storage.policies (name, bucket_id, operation, definition)
    SELECT 
      'Anyone can view avatars',
      'avatars',
      'SELECT',
      'true'
    WHERE NOT EXISTS (
      SELECT 1 FROM storage.policies 
      WHERE bucket_id = 'avatars' AND name = 'Anyone can view avatars'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Storage policies might need to be created via Dashboard
    RAISE NOTICE 'Storage policies should be created via Dashboard → Storage → Policies';
END;
$$;

-- ============================================================================
-- HELPER: Create invite code with 3-day expiry
-- ============================================================================

CREATE OR REPLACE FUNCTION create_invite_code(p_world_id UUID)
RETURNS TABLE(code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Generate unique code
  v_code := generate_invite_code();
  v_expires_at := NOW() + INTERVAL '3 days';
  
  -- Insert the invite code
  INSERT INTO invite_codes (code, world_id, created_by, expires_at)
  VALUES (v_code, p_world_id, auth.uid(), v_expires_at);
  
  RETURN QUERY SELECT v_code, v_expires_at;
END;
$$;

-- ============================================================================
-- HELPER: Validate and use invite code
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_invite_code(p_code TEXT)
RETURNS TABLE(
  valid BOOLEAN,
  world_id UUID,
  world_title TEXT,
  creator_id UUID,
  creator_name TEXT,
  creator_avatar TEXT,
  member_count BIGINT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
  v_world worlds%ROWTYPE;
  v_creator profiles%ROWTYPE;
  v_member_count BIGINT;
  v_already_member BOOLEAN;
BEGIN
  -- Find the invite code
  SELECT * INTO v_invite
  FROM invite_codes ic
  WHERE ic.code = UPPER(p_code);
  
  -- Check if code exists
  IF v_invite IS NULL THEN
    RETURN QUERY SELECT 
      FALSE, NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::BIGINT,
      'Invalid invite code'::TEXT;
    RETURN;
  END IF;
  
  -- Check if code is expired
  IF v_invite.expires_at < NOW() THEN
    RETURN QUERY SELECT 
      FALSE, NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::BIGINT,
      'This invite code has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check if max uses exceeded
  IF v_invite.max_uses IS NOT NULL AND v_invite.use_count >= v_invite.max_uses THEN
    RETURN QUERY SELECT 
      FALSE, NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::BIGINT,
      'This invite code has reached its maximum uses'::TEXT;
    RETURN;
  END IF;
  
  -- Check if user is already a member
  SELECT EXISTS (
    SELECT 1 FROM world_members wm
    WHERE wm.world_id = v_invite.world_id
    AND wm.user_id = auth.uid()
  ) INTO v_already_member;
  
  IF v_already_member THEN
    -- Still return world info so app can navigate to it
    SELECT * INTO v_world FROM worlds w WHERE w.id = v_invite.world_id;
    SELECT * INTO v_creator FROM profiles p WHERE p.id = v_world.created_by;
    SELECT COUNT(*) INTO v_member_count FROM world_members wm WHERE wm.world_id = v_invite.world_id;
    
    RETURN QUERY SELECT 
      FALSE, v_world.id, v_world.title, v_creator.id, v_creator.name, v_creator.avatar_url, v_member_count,
      'already_member'::TEXT;
    RETURN;
  END IF;
  
  -- Get world info
  SELECT * INTO v_world FROM worlds w WHERE w.id = v_invite.world_id;
  SELECT * INTO v_creator FROM profiles p WHERE p.id = v_world.created_by;
  SELECT COUNT(*) INTO v_member_count FROM world_members wm WHERE wm.world_id = v_invite.world_id;
  
  -- Valid!
  RETURN QUERY SELECT 
    TRUE, v_world.id, v_world.title, v_creator.id, v_creator.name, v_creator.avatar_url, v_member_count,
    NULL::TEXT;
END;
$$;

-- ============================================================================
-- HELPER: Join world using invite code
-- ============================================================================

CREATE OR REPLACE FUNCTION join_world_with_code(p_code TEXT)
RETURNS TABLE(
  success BOOLEAN,
  world_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
  v_already_member BOOLEAN;
BEGIN
  -- Find and validate the invite code
  SELECT * INTO v_invite
  FROM invite_codes ic
  WHERE ic.code = UPPER(p_code)
  AND ic.expires_at > NOW()
  AND (ic.max_uses IS NULL OR ic.use_count < ic.max_uses);
  
  IF v_invite IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid or expired invite code'::TEXT;
    RETURN;
  END IF;
  
  -- Check if already a member
  SELECT EXISTS (
    SELECT 1 FROM world_members wm
    WHERE wm.world_id = v_invite.world_id
    AND wm.user_id = auth.uid()
  ) INTO v_already_member;
  
  IF v_already_member THEN
    RETURN QUERY SELECT TRUE, v_invite.world_id, 'already_member'::TEXT;
    RETURN;
  END IF;
  
  -- Add user as member
  INSERT INTO world_members (world_id, user_id, role)
  VALUES (v_invite.world_id, auth.uid(), 'member');
  
  -- Increment use count
  UPDATE invite_codes
  SET use_count = use_count + 1
  WHERE id = v_invite.id;
  
  RETURN QUERY SELECT TRUE, v_invite.world_id, NULL::TEXT;
END;
$$;

-- ============================================================================
-- DONE!
-- ============================================================================

-- Summary of what was created:
-- 
-- TABLES:
--   - profiles (user display info + storage tracking)
--   - worlds (shared photo collections)
--   - world_members (who belongs to which world)
--   - invite_codes (shareable codes to join)
--   - media (photos/videos in worlds)
--
-- FUNCTIONS:
--   - generate_invite_code() - Creates unique 6-char code
--   - create_invite_code(world_id) - Creates invite with 3-day expiry
--   - validate_invite_code(code) - Validates code, returns world info
--   - join_world_with_code(code) - Joins user to world
--   - update_updated_at_column() - Auto-updates updated_at
--   - increment_storage_used() - Tracks storage on upload
--   - decrement_storage_used() - Tracks storage on delete
--
-- RLS POLICIES:
--   - All tables have row-level security enabled
--   - Users can only access data they're authorized to see
--
-- NEXT STEPS:
--   1. Create storage buckets in Dashboard → Storage:
--      - "avatars" (Public bucket)
--      - "world-covers" (Public bucket)
--      - "media" (Private bucket)
--   2. For each bucket, add these policies in Dashboard → Storage → Policies:
--      - avatars: Allow authenticated users to upload to their own folder
--      - avatars: Allow public read access
--      - world-covers: Allow world owners to upload
--      - world-covers: Allow public read access
--      - media: Allow world members to upload/read
