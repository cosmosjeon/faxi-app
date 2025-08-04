import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationPayload {
  recipient_user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

interface DeviceToken {
  id: string;
  token: string;
  device_type: 'FCM' | 'APNs';
  device_info?: Record<string, any>;
}

// FCM 서버 키 (Supabase Secrets에서 가져옴)
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';

// APNs 설정 (Supabase Secrets에서 가져옴)
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID');
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID');
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID');
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY');
const APNS_ENDPOINT = 'https://api.push.apple.com/3/device/';

/**
 * FCM을 통해 알림을 발송합니다
 */
async function sendFCMNotification(token: string, payload: PushNotificationPayload): Promise<boolean> {
  if (!FCM_SERVER_KEY) {
    console.error('FCM_SERVER_KEY가 설정되지 않았습니다');
    return false;
  }

  const fcmPayload = {
    to: token,
    notification: {
      title: payload.title,
      body: payload.body,
      sound: payload.sound || 'default',
      badge: payload.badge || 1,
    },
    data: payload.data || {},
    priority: 'high',
  };

  try {
    const response = await fetch(FCM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('FCM 발송 실패:', result);
      return false;
    }

    // FCM 응답에서 실패한 토큰 확인
    if (result.failure > 0) {
      console.warn('일부 FCM 토큰 발송 실패:', result);
      return false;
    }

    return true;
  } catch (error) {
    console.error('FCM 요청 중 오류:', error);
    return false;
  }
}

/**
 * APNs를 통해 알림을 발송합니다
 */
async function sendAPNsNotification(token: string, payload: PushNotificationPayload): Promise<boolean> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID || !APNS_PRIVATE_KEY) {
    console.error('APNs 설정이 완료되지 않았습니다');
    return false;
  }

  try {
    // JWT 토큰 생성 (APNs 인증용)
    const header = {
      alg: 'ES256',
      kid: APNS_KEY_ID,
    };

    const claims = {
      iss: APNS_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
    };

    // JWT 토큰 생성 로직 (실제 구현에서는 적절한 JWT 라이브러리 사용)
    const jwtToken = await generateJWT(header, claims, APNS_PRIVATE_KEY);

    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: payload.sound || 'default',
        badge: payload.badge || 1,
      },
      ...payload.data,
    };

    const response = await fetch(`${APNS_ENDPOINT}${token}`, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${jwtToken}`,
        'apns-topic': APNS_BUNDLE_ID,
        'apns-push-type': 'alert',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apnsPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('APNs 발송 실패:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('APNs 요청 중 오류:', error);
    return false;
  }
}

/**
 * JWT 토큰을 생성합니다 (APNs 인증용)
 */
async function generateJWT(header: any, claims: any, privateKey: string): Promise<string> {
  // 실제 구현에서는 적절한 JWT 라이브러리를 사용해야 합니다
  // 여기서는 간단한 예시로 대체
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedClaims = btoa(JSON.stringify(claims));
  
  // 실제로는 privateKey로 서명해야 합니다
  const signature = 'dummy_signature';
  
  return `${encodedHeader}.${encodedClaims}.${signature}`;
}

/**
 * 만료된 토큰을 데이터베이스에서 삭제합니다
 */
async function cleanupInvalidTokens(invalidTokenIds: string[]): Promise<void> {
  if (invalidTokenIds.length === 0) return;

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error } = await supabaseClient
    .from('device_tokens')
    .update({ is_active: false })
    .in('id', invalidTokenIds);

  if (error) {
    console.error('만료된 토큰 정리 실패:', error);
  } else {
    console.log(`${invalidTokenIds.length}개의 만료된 토큰을 비활성화했습니다`);
  }
}

serve(async (req) => {
  // CORS 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: PushNotificationPayload = await req.json();
    
    // 필수 필드 검증
    if (!payload.recipient_user_id || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: '필수 필드가 누락되었습니다' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Supabase 클라이언트 생성
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 수신자의 활성 디바이스 토큰 조회
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('device_tokens')
      .select('id, token, device_type')
      .eq('user_id', payload.recipient_user_id)
      .eq('is_active', true);

    if (tokensError) {
      console.error('토큰 조회 실패:', tokensError);
      return new Response(
        JSON.stringify({ error: '토큰 조회에 실패했습니다' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: '활성 디바이스 토큰이 없습니다' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 각 토큰에 대해 알림 발송
    const invalidTokenIds: string[] = [];
    let successCount = 0;

    for (const token of tokens) {
      let success = false;

      if (token.device_type === 'FCM') {
        success = await sendFCMNotification(token.token, payload);
      } else if (token.device_type === 'APNs') {
        success = await sendAPNsNotification(token.token, payload);
      }

      if (success) {
        successCount++;
      } else {
        invalidTokenIds.push(token.id);
      }
    }

    // 만료된 토큰 정리
    if (invalidTokenIds.length > 0) {
      await cleanupInvalidTokens(invalidTokenIds);
    }

    return new Response(
      JSON.stringify({
        message: '알림 발송 완료',
        total_tokens: tokens.length,
        success_count: successCount,
        invalid_tokens_cleaned: invalidTokenIds.length,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Edge Function 오류:', error);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}); 