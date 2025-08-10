-- ============================================================================
-- Migration: add privacy settings & privacy-aware search
-- Purpose  :
--   1) Add user_settings.profile_visibility, user_settings.show_online_status
--   2) Add can_view_profile(viewer_id, target_id)
--   3) Add RPC search_users_with_privacy(viewer_id, query)
-- Notes    : Idempotent. Safe to run multiple times.
-- ============================================================================

BEGIN;

-- 1) Create ENUM type for profile visibility if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'profile_visibility'
  ) THEN
    CREATE TYPE profile_visibility AS ENUM ('public', 'friends_only', 'private');
  END IF;
END $$;

-- 2) Add columns to user_settings (if not exists)
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS profile_visibility profile_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT true;

-- 3) Core function: can a viewer see a target's profile?
-- Security: SECURITY DEFINER to allow controlled access despite RLS
CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visibility profile_visibility;
  v_is_friend BOOLEAN := FALSE;
BEGIN
  -- Self can always view
  IF viewer_id = target_id THEN
    RETURN TRUE;
  END IF;

  -- Read target's visibility; default to public when absent
  SELECT us.profile_visibility
  INTO v_visibility
  FROM public.user_settings us
  WHERE us.user_id = target_id;

  IF v_visibility IS NULL THEN
    RETURN TRUE; -- backward compatibility
  END IF;

  IF v_visibility = 'public' THEN
    RETURN TRUE;
  ELSIF v_visibility = 'friends_only' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE (
        (f.user_id = target_id AND f.friend_id = viewer_id)
        OR
        (f.user_id = viewer_id AND f.friend_id = target_id)
      )
      AND f.status = 'accepted'
    ) INTO v_is_friend;

    RETURN COALESCE(v_is_friend, FALSE);
  ELSE
    -- private
    RETURN FALSE;
  END IF;
END;
$$;

-- 4) Privacy-aware user search RPC
-- Returns only users that the viewer is allowed to see
CREATE OR REPLACE FUNCTION public.search_users_with_privacy(viewer_id UUID, query TEXT)
RETURNS TABLE (
  id UUID,
  username VARCHAR,
  display_name VARCHAR,
  avatar_url TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.is_active,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.is_active = TRUE
    AND (
      u.username ILIKE '%' || query || '%'
      OR u.display_name ILIKE '%' || query || '%'
    )
    AND public.can_view_profile(viewer_id, u.id) = TRUE
  ORDER BY u.display_name ASC
  LIMIT 50;
$$;

-- 5) Grants (allow authenticated role to call the RPC)
DO $$
BEGIN
  -- function OIDs can vary, so reference by signature
  GRANT EXECUTE ON FUNCTION public.can_view_profile(UUID, UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.search_users_with_privacy(UUID, TEXT) TO authenticated;
EXCEPTION WHEN OTHERS THEN
  -- Avoid breaking idempotency on environments without role
  NULL;
END $$;

COMMIT;

-- ============================================================================
-- End of migration
-- ============================================================================


