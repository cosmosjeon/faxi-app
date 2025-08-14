import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  user_ids: string[]
  title: string
  body: string
  type: 'new_message' | 'friend_request' | 'close_friend_request'
  data?: Record<string, any>
}

// 단순화된 Firebase 서버 키 사용 방식
async function getServerKey() {
  const serverKey = Deno.env.get('FIREBASE_SERVER_KEY')
  
  if (!serverKey) {
    throw new Error('FIREBASE_SERVER_KEY 환경 변수가 설정되지 않았습니다.')
  }
  
  console.log('Firebase 서버 키 확인됨')
  return serverKey
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Edge Function 시작')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { user_ids, title, body, type, data }: NotificationPayload = await req.json()
    console.log('받은 데이터:', { user_ids, title, body, type })

    // FCM 토큰 조회
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('push_tokens')
      .select('fcm_token, user_id')
      .in('user_id', user_ids)
      .eq('is_active', true)

    console.log('토큰 조회 결과:', tokens?.length, '개')

    if (tokensError) {
      throw tokensError
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Firebase Legacy API 사용 (단순하고 안정적)
    const serverKey = await getServerKey()
    console.log('Firebase 서버 키 준비 완료')

    const results = []
    const fcmEndpoint = 'https://fcm.googleapis.com/fcm/send'

    // 배치 전송을 위해 토큰들을 그룹화
    const registration_ids = tokens.map(token => token.fcm_token)
    
    const message = {
      registration_ids,
      notification: {
        title,
        body,
        icon: data?.senderProfileImage || '/icons/default-avatar.png',
        badge: '/icons/faxi-badge.png',
        click_action: getClickAction(type, data)
      },
      data: {
        type,
        click_action: getClickAction(type, data),
        ...data
      },
      // TWA 환경을 위한 추가 설정
      webpush: {
        notification: {
          icon: data?.senderProfileImage || '/icons/default-avatar.png',
          badge: '/icons/faxi-badge.png',
          requireInteraction: type === 'new_message',
          tag: `faxi-${type}-${data?.senderId || Date.now()}`
        },
        fcm_options: {
          link: getClickAction(type, data)
        }
      }
    }

    try {
      console.log('FCM 배치 전송 시도, 토큰 수:', registration_ids.length)
      
      const response = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      const result = await response.json()
      console.log('FCM 배치 전송 결과:', result)
      
      // 개별 결과 처리
      if (result.results) {
        result.results.forEach((res: any, index: number) => {
          results.push({
            user_id: tokens[index].user_id,
            success: !res.error,
            result: res
          })
        })
      } else {
        // 전체 실패 처리
        tokens.forEach(token => {
          results.push({
            user_id: token.user_id,
            success: false,
            error: result.error || 'Unknown error'
          })
        })
      }

    } catch (error) {
      console.error('FCM 전송 실패:', error)
      tokens.forEach(token => {
        results.push({
          user_id: token.user_id,
          success: false,
          error: error.message
        })
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent_count: results.filter(r => r.success).length,
        total_count: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge Function 오류:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function getClickAction(type: string, data?: Record<string, any>): string {
  switch (type) {
    case 'friend_request':
    case 'close_friend_request':
      return '/friends/requests'
    case 'new_message':
      return `/home?messageId=${data?.messageId || ''}`
    default:
      return '/'
  }
}