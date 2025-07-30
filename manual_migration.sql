-- 수동 마이그레이션: Supabase 대시보드 SQL Editor에서 실행하세요 (MVP 버전)

-- 1단계: MVP 알림 설정 필드 추가
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS message_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS marketing_notifications BOOLEAN DEFAULT false;

-- 2단계: 개인정보 설정 필드 추가
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) DEFAULT 'public' 
    CHECK (profile_visibility IN ('public', 'friends_only', 'private')),
ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_last_seen BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS message_from_strangers BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS friend_suggestions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS find_by_username BOOLEAN DEFAULT true;

-- 3단계: 데이터 관리 필드 추가
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS save_message_history BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_delete_old_messages BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_delete_days INTEGER DEFAULT 90 CHECK (auto_delete_days > 0);

-- 4단계: FAQ 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS public.faq_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    helpful_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5단계: FAQ 테이블에 트리거 추가 (update_updated_at_column 함수가 있는 경우)
-- DROP TRIGGER IF EXISTS update_faq_items_updated_at ON public.faq_items;
-- CREATE TRIGGER update_faq_items_updated_at 
--     BEFORE UPDATE ON public.faq_items 
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6단계: FAQ RLS 정책
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FAQ items are viewable by everyone" ON public.faq_items;
CREATE POLICY "FAQ items are viewable by everyone" ON public.faq_items FOR SELECT USING (is_active = true);

-- 7단계: FAQ 함수 생성
CREATE OR REPLACE FUNCTION increment_faq_helpful(faq_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.faq_items 
    SET helpful_count = helpful_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = faq_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8단계: 샘플 FAQ 데이터 삽입
INSERT INTO public.faq_items (category, question, answer, order_index) VALUES
('getting_started', 'FAXI는 어떤 앱인가요?', 'FAXI는 친구들과 실시간으로 메시지와 사진을 주고받아 인스턴트 프린터로 출력할 수 있는 소셜 메시징 앱입니다. 마치 편지를 주고받는 것처럼 따뜻한 소통을 할 수 있습니다.', 1),
('getting_started', '처음 사용할 때 무엇을 해야 하나요?', '1. Google 또는 Kakao 계정으로 로그인\n2. 프로필 설정 (사용자명, 표시이름)\n3. 친구 추가\n4. 프린터 연결\n5. 첫 메시지 보내기', 2),
('messaging', '메시지는 어떻게 보내나요?', '작성 탭에서 친구를 선택하고 텍스트나 사진을 첨부한 후 전송 버튼을 누르면 됩니다. 상대방 프린터로 자동 출력되거나 승인 후 출력됩니다.', 1),
('messaging', 'LCD 티저 메시지는 무엇인가요?', '프린터의 작은 LCD 화면에 표시되는 짧은 메시지입니다. 최대 10자까지 입력할 수 있으며, 누가 메시지를 보냈는지 알려주는 역할을 합니다.', 2),
('printer_setup', '어떤 프린터가 호환되나요?', '현재 Bluetooth 연결을 지원하는 써멀 프린터들과 호환됩니다. 추천 모델은 설정 > 도움말 > 호환 기기에서 확인할 수 있습니다.', 1),
('friends', '친한친구는 무엇인가요?', '특별히 가까운 친구로 설정할 수 있는 기능입니다. 친한친구로 설정하면 메시지가 자동으로 승인되어 바로 프린트됩니다.', 1),
('troubleshooting', '앱이 계속 멈춰요', '1. 앱을 완전히 종료 후 재시작\n2. 브라우저 캐시 삭제\n3. 기기 재시작\n4. 문제가 지속되면 고객지원에 문의', 1)
ON CONFLICT (id) DO NOTHING;

-- 완료 메시지
SELECT 'Migration completed successfully!' as result;