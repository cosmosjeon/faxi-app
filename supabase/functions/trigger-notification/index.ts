import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationEvent {
  eventType: 'FRIEND_REQUEST' | 'FRIEND_ACCEPT' | 'NEW_MESSAGE' | 'PRINT_COMPLETED' | 'PRINT_ERROR';
  recipientUserId: string;
  senderUserId?: string;
  senderName?: string;
  messageId?: string;
  printId?: string;
  teaser?: string;
  errorMessage?: string;
  additionalData?: Record<string, any>;
}

interface NotificationMessage {
  title: string;
  body: string;
  data: Record<string, any>;
  badge?: number;
  sound?: string;
}

/**
 * 이벤트 타입에 따른 알림 메시지 생성
 */
function createNotificationMessage(event: NotificationEvent): NotificationMessage {
  const baseData = {
    eventType: event.eventType,
    timestamp: new Date().toISOString(),
    ...event.additionalData
  };

  switch (event.eventType) {
    case 'FRIEND_REQUEST':
      return {
        title: '새로운 친구 요청',
        body: `${event.senderName || '알 수 없는 사용자'}님이 친구가 되고 싶어해요.`,
        data: {
          ...baseData,
          senderUserId: event.senderUserId,
          senderName: event.senderName
        },
        badge: 1,
        sound: 'default'
      };

    case 'FRIEND_ACCEPT':
      return {
        title: '친구 요청 수락',
        body: `${event.senderName || '알 수 없는 사용자'}님이 친구 요청을 수락했어요!`,
        data: {
          ...baseData,
          senderUserId: event.senderUserId,
          senderName: event.senderName
        },
        badge: 1,
        sound: 'default'
      };

    case 'NEW_MESSAGE':
      return {
        title: '새로운 프린트 도착!',
        body: `"${event.teaser || '새 메시지'}" from ${event.senderName || '알 수 없는 사용자'}`,
        data: {
          ...baseData,
          messageId: event.messageId,
          senderUserId: event.senderUserId,
          senderName: event.senderName,
          teaser: event.teaser
        },
        badge: 1,
        sound: 'default'
      };

    case 'PRINT_COMPLETED':
      return {
        title: '프린트 완료',
        body: '메시지가 성공적으로 프린트되었습니다.',
        data: {
          ...baseData,
          printId: event.printId
        },
        badge: 0,
        sound: 'default'
      };

    case 'PRINT_ERROR':
      return {
        title: '프린트 오류',
        body: event.errorMessage || '프린트 중 오류가 발생했습니다.',
        data: {
          ...baseData,
          printId: event.printId,
          errorMessage: event.errorMessage
        },
        badge: 0,
        sound: 'default'
      };

    default:
      throw new Error(`지원하지 않는 이벤트 타입: ${event.eventType}`);
  }
}

/**
 * 사용자의 활성 디바이스 토큰들을 조회
 */
async function getUserActiveTokens(supabaseClient: any, userId: string): Promise<any[]> {
  const { data, error } = await supabaseClient
    .from('device_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('활성 토큰 조회 실패:', error);
    throw new Error('토큰 조회에 실패했습니다');
  }

  return data || [];
}

/**
 * send-push-notification 함수 호출
 */
async function sendPushNotification(payload: {
  recipient_user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다');
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  // 사용자의 활성 토큰들 조회
  const tokens = await getUserActiveTokens(supabaseClient, payload.recipient_user_id);
  
  if (tokens.length === 0) {
    console.log(`사용자 ${payload.recipient_user_id}의 활성 토큰이 없습니다`);
    return;
  }

  // send-push-notification 함수 호출
  const { data, error } = await supabaseClient.functions.invoke('send-push-notification', {
    body: payload
  });

  if (error) {
    console.error('푸시 알림 발송 실패:', error);
    throw new Error('푸시 알림 발송에 실패했습니다');
  }

  console.log(`푸시 알림 발송 완료: ${tokens.length}개 디바이스`);
}

serve(async (req) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { event }: { event: NotificationEvent } = await req.json();

    // 필수 필드 검증
    if (!event.eventType || !event.recipientUserId) {
      return new Response(
        JSON.stringify({ error: '필수 필드가 누락되었습니다' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 알림 메시지 생성
    const notificationMessage = createNotificationMessage(event);

    // 푸시 알림 발송
    await sendPushNotification({
      recipient_user_id: event.recipientUserId,
      ...notificationMessage
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '알림이 성공적으로 발송되었습니다' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('trigger-notification 오류:', error);
    
    return new Response(
      JSON.stringify({ 
        error: '알림 발송 중 오류가 발생했습니다',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}); 