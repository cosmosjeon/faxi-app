-- ########## 친구 관계 확인 로직 수정 ##########

-- 1. 친구 관계 확인 함수 (디버깅 강화)
CREATE OR REPLACE FUNCTION public.check_friendship_status(
    user1_id UUID,
    user2_id UUID
) RETURNS JSON AS $$
DECLARE
    result JSON;
    friendship_data RECORD;
BEGIN
    -- 양방향 친구 관계 조회
    SELECT 
        COUNT(*) as total_relations,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted_relations,
        json_agg(
            json_build_object(
                'user_id', user_id,
                'friend_id', friend_id, 
                'status', status,
                'direction', CASE 
                    WHEN user_id = user1_id THEN 'user1_to_user2'
                    ELSE 'user2_to_user1'
                END
            )
        ) as relations
    INTO friendship_data
    FROM public.friendships 
    WHERE (
        (user_id = user1_id AND friend_id = user2_id) OR
        (user_id = user2_id AND friend_id = user1_id)
    );
    
    result := json_build_object(
        'user1_id', user1_id,
        'user2_id', user2_id,
        'total_relations', friendship_data.total_relations,
        'accepted_relations', friendship_data.accepted_relations,
        'are_friends', friendship_data.accepted_relations >= 1,
        'are_mutual_friends', friendship_data.accepted_relations >= 2,
        'relations_detail', friendship_data.relations
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 친한친구 신청 수락 함수 (수정된 친구 관계 확인)
CREATE OR REPLACE FUNCTION public.accept_close_friend_request(
    request_id UUID
) RETURNS JSON AS $$
DECLARE
    req_record public.close_friend_requests%ROWTYPE;
    friendship_check JSON;
    affected_rows INTEGER := 0;
    result JSON;
BEGIN
    -- 1. 요청 정보 조회 및 검증
    SELECT * INTO req_record 
    FROM public.close_friend_requests 
    WHERE id = request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Request not found or already processed'
        );
    END IF;
    
    -- 2. 권한 확인 (target_id만 수락 가능)
    IF auth.uid() != req_record.target_id THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Unauthorized'
        );
    END IF;
    
    -- 3. 친구 관계 상세 확인 (디버깅 강화)
    SELECT public.check_friendship_status(req_record.requester_id, req_record.target_id)
    INTO friendship_check;
    
    -- 친구 관계가 없는 경우 (최소 1개의 accepted 관계 필요)
    IF (friendship_check->>'are_friends')::boolean = false THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Users must be friends first',
            'debug_info', friendship_check
        );
    END IF;
    
    -- 4. 트랜잭션 시작: 친한친구 관계 업데이트
    BEGIN
        -- 4-1. 모든 관련 friendships 레코드 업데이트 (양방향)
        UPDATE public.friendships 
        SET is_close_friend = true, updated_at = CURRENT_TIMESTAMP
        WHERE (
            (user_id = req_record.requester_id AND friend_id = req_record.target_id) OR
            (user_id = req_record.target_id AND friend_id = req_record.requester_id)
        ) AND status = 'accepted';
        
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        
        -- 4-2. 요청 상태를 accepted로 변경
        UPDATE public.close_friend_requests 
        SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
        WHERE id = request_id;
        
        -- 4-3. 성공 결과 반환
        result := json_build_object(
            'success', true,
            'requester_id', req_record.requester_id,
            'target_id', req_record.target_id,
            'updated_friendships', affected_rows,
            'friendship_check', friendship_check,
            'message', 'Close friend relationship established successfully'
        );
        
        RETURN result;
        
    EXCEPTION WHEN OTHERS THEN
        -- 에러 발생 시 롤백 및 에러 반환
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to update friendship: ' || SQLERRM,
            'friendship_check', friendship_check
        );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. are_close_friends 함수도 같은 로직으로 수정
CREATE OR REPLACE FUNCTION public.are_close_friends(
    user1_id UUID,
    user2_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN := false;
    close_friend_count INTEGER := 0;
BEGIN
    -- 양방향 친한친구 관계 확인 (최소 1개 이상)
    SELECT COUNT(*) INTO close_friend_count
    FROM public.friendships 
    WHERE (
        (user_id = user1_id AND friend_id = user2_id) OR
        (user_id = user2_id AND friend_id = user1_id)
    ) 
    AND status = 'accepted' 
    AND is_close_friend = true;
    
    -- 최소 1개 이상의 친한친구 관계가 있으면 true
    result := close_friend_count >= 1;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 완료 메시지
SELECT '🔧 친구 관계 확인 로직 수정 완료!' as result;