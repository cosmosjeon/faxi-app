-- 디바이스 토큰 관리 테이블 생성
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type VARCHAR(10) NOT NULL CHECK (device_type IN ('FCM', 'APNs')),
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 사용자별 토큰 중복 방지
    UNIQUE(user_id, token)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON public.device_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_tokens_device_type ON public.device_tokens(device_type);

-- 업데이트 트리거
CREATE TRIGGER update_device_tokens_updated_at 
    BEFORE UPDATE ON public.device_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책 설정
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 토큰만 관리 가능
CREATE POLICY "Users can manage their own device tokens" ON public.device_tokens
    FOR ALL USING (auth.uid() = user_id);

-- 서비스 역할은 모든 토큰에 접근 가능 (알림 발송용)
CREATE POLICY "Service role can access all device tokens" ON public.device_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- 토큰 비활성화 함수
CREATE OR REPLACE FUNCTION deactivate_device_token(token_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.device_tokens 
    SET is_active = false, 
        updated_at = CURRENT_TIMESTAMP
    WHERE id = token_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 만료된 토큰 정리 함수 (30일 이상 미사용)
CREATE OR REPLACE FUNCTION cleanup_expired_device_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.device_tokens 
    WHERE last_used_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
      AND is_active = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자별 활성 토큰 조회 함수
CREATE OR REPLACE FUNCTION get_user_active_tokens(user_uuid UUID)
RETURNS TABLE(
    id UUID,
    token TEXT,
    device_type VARCHAR(10),
    device_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT dt.id, dt.token, dt.device_type, dt.device_info
    FROM public.device_tokens dt
    WHERE dt.user_id = user_uuid 
      AND dt.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 