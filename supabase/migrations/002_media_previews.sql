-- ============================================================================
-- MEDIA PREVIEWS + STORAGE TRACKING
-- ============================================================================
-- Adds preview fields for Relive playback and updates storage accounting.
--
-- Preview files are smaller copies of images intended for rapid rewatching.
-- They count against user storage, so triggers include preview_size.

-- Add preview fields to media
ALTER TABLE media
  ADD COLUMN IF NOT EXISTS preview_path TEXT,
  ADD COLUMN IF NOT EXISTS preview_size BIGINT NOT NULL DEFAULT 0;

-- Update storage triggers to include preview bytes
CREATE OR REPLACE FUNCTION increment_storage_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET storage_used = storage_used + NEW.file_size + NEW.preview_size
  WHERE id = NEW.owner_id;

  -- Also increment photo_count for the world member
  UPDATE world_members
  SET photo_count = photo_count + 1
  WHERE world_id = NEW.world_id AND user_id = NEW.owner_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_storage_used()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET storage_used = GREATEST(0, storage_used - OLD.file_size - OLD.preview_size)
  WHERE id = OLD.owner_id;

  -- Also decrement photo_count for the world member
  UPDATE world_members
  SET photo_count = GREATEST(0, photo_count - 1)
  WHERE world_id = OLD.world_id AND user_id = OLD.owner_id;

  RETURN OLD;
END;
$$;
