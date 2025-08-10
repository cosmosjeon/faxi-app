-- =============================================================================
-- Migration: add user presence (online/last seen)
-- Purpose  :
--   1) Create public.user_presence table
--   2) RLS policies: owner write, friends can read when show_online_status=true
--   3) Index for recent presence queries
-- Notes    : Idempotent. Safe to run multiple times.
-- =============================================================================

BEGIN;

-- 1) Table
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) updated_at trigger (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_user_presence_updated_at'
  ) THEN
    CREATE TRIGGER update_user_presence_updated_at
    BEFORE UPDATE ON public.user_presence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 3) Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- 4) Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_presence' AND policyname = 'owner_can_write_presence'
  ) THEN
    CREATE POLICY "owner_can_write_presence"
    ON public.user_presence
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_presence' AND policyname = 'owner_can_update_presence'
  ) THEN
    CREATE POLICY "owner_can_update_presence"
    ON public.user_presence
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_presence' AND policyname = 'friends_can_view_presence_when_allowed'
  ) THEN
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
      AND EXISTS (
        SELECT 1
        FROM public.user_settings us
        WHERE us.user_id = user_presence.user_id
          AND COALESCE(us.show_online_status, true) = true
      )
    );
  END IF;
END $$;

-- 5) Index
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen_at ON public.user_presence (last_seen_at DESC);

COMMIT;

-- =============================================================================
-- End of migration
-- =============================================================================


