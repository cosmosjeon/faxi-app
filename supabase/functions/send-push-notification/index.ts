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

// Firebase Admin SDK를 사용한 액세스 토큰 생성
async function getAccessToken() {
  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}')
  
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600

  // JWT Header
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }

  // JWT Payload
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp
  }

  // Base64 URL encode
  const base64UrlEncode = (obj: any) => {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  const encodedHeader = base64UrlEncode(header)
  const encodedPayload = base64UrlEncode(payload)
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  // Private key 포맷팅 (PEM 형식)
  const privateKey = serviceAccount.private_key
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
    .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')

  // 간단한 방법: 외부 JWT 서비스 사용 (임시)
  try {
    // RSA 서명을 위한 WebCrypto API 사용
    const pemHeader = '-----BEGIN PRIVATE KEY-----'
    const pemFooter = '-----END PRIVATE KEY-----'
    const pemContents = privateKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '')
    
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
    
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    )

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    const jwt = `${unsignedToken}.${encodedSignature}`

    // Access token 요청
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    const tokenData = await response.json()
    return tokenData.access_token
  } catch (error) {
    console.error('JWT 생성 오류:', error)
    throw error
  }
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

    // Firebase HTTP v1 API 사용
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
    console.log('Firebase 프로젝트 ID:', projectId)
    
    const accessToken = await getAccessToken()
    console.log('액세스 토큰 생성 완료')

    const results = []
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    for (const token of tokens) {
      const message = {
        message: {
          token: token.fcm_token,
          notification: {
            title,
            body,
          },
          webpush: {
            notification: {
              icon: data?.senderProfileImage || '/icons/default-avatar.png',
              badge: '/icons/faxi-badge.png',
            },
            fcm_options: {
              link: getClickAction(type, data)
            }
          },
          data: {
            type,
            ...data
          }
        }
      }

      try {
        const response = await fetch(fcmEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        })

        const result = await response.json()
        
        results.push({
          user_id: token.user_id,
          success: response.ok,
          result: result
        })

        console.log(`FCM 전송 ${response.ok ? '성공' : '실패'}:`, result)
      } catch (error) {
        results.push({
          user_id: token.user_id,
          success: false,
          error: error.message
        })
      }
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