-- =============================================================================
-- Migration: fix presence select policy (treat missing settings as default visible)
-- Purpose  : If a user has no row in user_settings, default to show_online_status=true
-- Notes    : Idempotent. Safe to run multiple times.
-- =============================================================================

BEGIN;

-- Drop old policy if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_presence' AND policyname='friends_can_view_presence_when_allowed'
  ) THEN
    DROP POLICY "friends_can_view_presence_when_allowed" ON public.user_presence;
  END IF;
END $$;

-- Re-create policy: allow when
-- 1) viewer and target are accepted friends, and
-- 2) (no settings row) OR (show_online_status is true)
CREATE POLICY "friends_can_view_presence_when_allowed"
ON public.user_presence
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = user_presence.user_id AND f.friend_id = auth.uid())
        OR (f.friend_id = user_presence.user_id AND f.user_id = auth.uid())
      )
  )
  AND (
    NOT EXISTS (
      SELECT 1 FROM public.user_settings us WHERE us.user_id = user_presence.user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_settings us
      WHERE us.user_id = user_presence.user_id
        AND COALESCE(us.show_online_status, true) = true
    )
  )
);

COMMIT;

-- =============================================================================
-- End of migration
-- =============================================================================


