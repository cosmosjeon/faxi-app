-- 알림 설정 필드 추가
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS 
    -- 메시지 알림
    message_notifications BOOLEAN DEFAULT true,
    message_sound BOOLEAN DEFAULT true,
    message_vibration BOOLEAN DEFAULT true,
    message_preview BOOLEAN DEFAULT true,
    
    -- 친구 관련 알림
    friend_request_notifications BOOLEAN DEFAULT true,
    friend_accepted_notifications BOOLEAN DEFAULT true,
    
    -- 프린터 알림
    printer_connection_notifications BOOLEAN DEFAULT true,
    print_completion_notifications BOOLEAN DEFAULT true,
    print_error_notifications BOOLEAN DEFAULT true,
    
    -- 시스템 알림
    system_notifications BOOLEAN DEFAULT true,
    marketing_notifications BOOLEAN DEFAULT false,
    
    -- 방해금지 시간
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    
    -- 개인정보 설정
    profile_visibility VARCHAR(20) DEFAULT 'public' CHECK (profile_visibility IN ('public', 'friends_only', 'private')),
    show_online_status BOOLEAN DEFAULT true,
    show_last_seen BOOLEAN DEFAULT true,
    message_from_strangers BOOLEAN DEFAULT true,
    friend_suggestions BOOLEAN DEFAULT true,
    find_by_username BOOLEAN DEFAULT true,
    save_message_history BOOLEAN DEFAULT true,
    auto_delete_old_messages BOOLEAN DEFAULT false,
    auto_delete_days INTEGER DEFAULT 90 CHECK (auto_delete_days > 0);

-- FAQ 테이블 생성
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

-- FAQ 업데이트 트리거
CREATE TRIGGER update_faq_items_updated_at 
    BEFORE UPDATE ON public.faq_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FAQ RLS 정책
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FAQ items are viewable by everyone" ON public.faq_items FOR SELECT USING (is_active = true);

-- 기본 FAQ 데이터 삽입
INSERT INTO public.faq_items (category, question, answer, order_index) VALUES
-- 시작하기
('getting_started', 'FAXI는 어떤 앱인가요?', 'FAXI는 친구들과 실시간으로 메시지와 사진을 주고받아 인스턴트 프린터로 출력할 수 있는 소셜 메시징 앱입니다. 마치 편지를 주고받는 것처럼 따뜻한 소통을 할 수 있습니다.', 1),
('getting_started', '처음 사용할 때 무엇을 해야 하나요?', '1. Google 또는 Kakao 계정으로 로그인\n2. 프로필 설정 (사용자명, 표시이름)\n3. 친구 추가\n4. 프린터 연결\n5. 첫 메시지 보내기', 2),
('getting_started', '친구를 어떻게 추가하나요?', '친구 탭에서 사용자명으로 검색하거나, 친구 추가 버튼을 통해 요청을 보낼 수 있습니다. 상대방이 수락하면 메시지를 주고받을 수 있습니다.', 3),

-- 메시지 관련
('messaging', '메시지는 어떻게 보내나요?', '작성 탭에서 친구를 선택하고 텍스트나 사진을 첨부한 후 전송 버튼을 누르면 됩니다. 상대방 프린터로 자동 출력되거나 승인 후 출력됩니다.', 1),
('messaging', 'LCD 티저 메시지는 무엇인가요?', '프린터의 작은 LCD 화면에 표시되는 짧은 메시지입니다. 최대 10자까지 입력할 수 있으며, 누가 메시지를 보냈는지 알려주는 역할을 합니다.', 2),
('messaging', '메시지가 프린트되지 않아요', '1. 프린터 연결 상태 확인\n2. 프린터 용지 및 배터리 상태 확인\n3. 상대방의 자동승인 설정 확인\n4. 앱을 재시작 후 다시 시도', 3),

-- 프린터 설정
('printer_setup', '어떤 프린터가 호환되나요?', '현재 Bluetooth 연결을 지원하는 써멀 프린터들과 호환됩니다. 추천 모델은 설정 > 도움말 > 호환 기기에서 확인할 수 있습니다.', 1),
('printer_setup', '프린터 연결이 안 돼요', '1. Bluetooth가 켜져있는지 확인\n2. 프린터가 페어링 모드인지 확인\n3. 브라우저에서 Bluetooth 권한 허용\n4. 프린터를 재시작 후 다시 연결 시도', 2),

-- 친구 관리
('friends', '친한친구는 무엇인가요?', '특별히 가까운 친구로 설정할 수 있는 기능입니다. 친한친구로 설정하면 메시지가 자동으로 승인되어 바로 프린트됩니다.', 1),
('friends', '친구를 차단할 수 있나요?', '현재 버전에서는 친구 삭제만 가능합니다. 차단 기능은 향후 업데이트에서 추가될 예정입니다.', 2),

-- 문제해결
('troubleshooting', '앱이 계속 멈춰요', '1. 앱을 완전히 종료 후 재시작\n2. 브라우저 캐시 삭제\n3. 기기 재시작\n4. 문제가 지속되면 고객지원에 문의', 1),
('troubleshooting', '알림이 오지 않아요', '1. 브라우저 알림 권한 확인\n2. 설정 > 알림 설정에서 알림 활성화 확인\n3. 방해금지 시간 설정 확인', 2);

-- FAQ 도움됨 카운트 증가 함수
CREATE OR REPLACE FUNCTION increment_faq_helpful(faq_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.faq_items 
    SET helpful_count = helpful_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = faq_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;