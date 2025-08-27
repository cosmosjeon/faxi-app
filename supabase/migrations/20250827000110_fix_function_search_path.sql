-- =============================================================================
-- Migration: fix function search_path (set to public)
-- Purpose  : Address Supabase linter WARN 0011_function_search_path_mutable
-- Notes    : Idempotent. Safe to run multiple times.
-- =============================================================================

BEGIN;

-- Trigger helpers and RPCs
ALTER FUNCTION public.notify_new_message() SET search_path = public;
ALTER FUNCTION public.notify_friendship_change() SET search_path = public;
ALTER FUNCTION public.notify_message_status_change() SET search_path = public;
ALTER FUNCTION public.notify_close_friend_request() SET search_path = public;
ALTER FUNCTION public.auto_approve_message() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Friendship / close-friend functions
ALTER FUNCTION public.are_close_friends(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.remove_close_friendship(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.check_friendship_status(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.accept_close_friend_request(uuid) SET search_path = public;

-- Messages RPC
ALTER FUNCTION public.get_queued_messages_for_user(uuid) SET search_path = public;

COMMIT;

-- =============================================================================
-- End of migration
-- =============================================================================


