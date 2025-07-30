-- 빠른 수정: 마케팅 알림 필드만 추가
-- Supabase 대시보드 SQL Editor에서 실행하세요

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS message_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS marketing_notifications BOOLEAN DEFAULT false;

-- 확인용 쿼리
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_settings' 
  AND table_schema = 'public'
  AND column_name IN ('message_notifications', 'marketing_notifications', 'auto_print_close_friends')
ORDER BY column_name;