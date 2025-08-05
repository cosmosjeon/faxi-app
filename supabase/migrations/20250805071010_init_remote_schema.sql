

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."friendship_status" AS ENUM (
    'pending',
    'accepted',
    'blocked'
);


ALTER TYPE "public"."friendship_status" OWNER TO "postgres";


CREATE TYPE "public"."print_status" AS ENUM (
    'pending',
    'approved',
    'completed',
    'failed',
    'queued'
);


ALTER TYPE "public"."print_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_close_friend_request"("request_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."accept_close_friend_request"("request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."are_close_friends"("user1_id" "uuid", "user2_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."are_close_friends"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_approve_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  should_auto_print BOOLEAN;
BEGIN
  -- 1. 수신자의 자동 프린트 설정 확인
  SELECT auto_print_close_friends INTO should_auto_print
  FROM public.user_settings WHERE user_id = NEW.receiver_id;

  -- 2. 설정이 활성화되어 있고 발신자가 친한친구인 경우 자동 승인
  IF should_auto_print AND public.are_close_friends(NEW.sender_id, NEW.receiver_id) THEN
      NEW.print_status = 'approved';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_approve_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_friendship_status"("user1_id" "uuid", "user2_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."check_friendship_status"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_queued_messages_for_user"("user_id_param" "uuid") RETURNS TABLE("id" "uuid", "sender_id" "uuid", "receiver_id" "uuid", "content" "text", "image_url" "text", "lcd_teaser" character varying, "print_status" "public"."print_status", "created_at" timestamp with time zone, "sender_display_name" character varying, "sender_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.image_url,
        m.lcd_teaser,
        m.print_status,
        m.created_at,
        COALESCE(u.display_name, 'Unknown User') as sender_display_name,
        u.avatar_url as sender_avatar_url
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.receiver_id = user_id_param 
      AND m.print_status = 'queued'
    ORDER BY m.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_queued_messages_for_user"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_close_friend_request"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_notify(
            'close_friend_request', 
            json_build_object(
                'type', 'new_close_friend_request',
                'requester_id', NEW.requester_id,
                'target_id', NEW.target_id,
                'request_id', NEW.id,
                'status', NEW.status
            )::text
        );
        RETURN NEW;
    END IF;
    
    -- 친한친구 요청 상태 변경
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        IF NEW.status = 'accepted' THEN
            PERFORM pg_notify(
                'close_friend_request_accepted', 
                json_build_object(
                    'type', 'close_friend_request_accepted',
                    'requester_id', NEW.requester_id,
                    'accepter_id', NEW.target_id,
                    'request_id', NEW.id
                )::text
            );
        END IF;
        
        IF NEW.status = 'rejected' THEN
            PERFORM pg_notify(
                'close_friend_request_rejected', 
                json_build_object(
                    'type', 'close_friend_request_rejected',
                    'requester_id', NEW.requester_id,
                    'rejecter_id', NEW.target_id,
                    'request_id', NEW.id
                )::text
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_close_friend_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_friendship_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- 새 친구 요청 (INSERT)
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_notify(
            'friendship_request', 
            json_build_object(
                'type', 'new_request',
                'requester_id', NEW.user_id,
                'requestee_id', NEW.friend_id,
                'friendship_id', NEW.id,
                'status', NEW.status
            )::text
        );
        RETURN NEW;
    END IF;
    
    -- 친구 요청 상태 변경 (UPDATE)
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        -- 친구 요청 수락
        IF NEW.status = 'accepted' THEN
            PERFORM pg_notify(
                'friendship_accepted', 
                json_build_object(
                    'type', 'request_accepted',
                    'requester_id', NEW.user_id,
                    'accepter_id', NEW.friend_id,
                    'friendship_id', NEW.id
                )::text
            );
        END IF;
        
        -- 친구 요청 거절
        IF NEW.status = 'blocked' THEN
            PERFORM pg_notify(
                'friendship_rejected', 
                json_build_object(
                    'type', 'request_rejected',
                    'requester_id', NEW.user_id,
                    'rejecter_id', NEW.friend_id,
                    'friendship_id', NEW.id
                )::text
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- 친한친구 상태 변경
    IF TG_OP = 'UPDATE' AND OLD.is_close_friend != NEW.is_close_friend THEN
        PERFORM pg_notify(
            'close_friend_update', 
            json_build_object(
                'type', 'close_friend_status_changed',
                'user_id', NEW.user_id,
                'friend_id', NEW.friend_id,
                'is_close_friend', NEW.is_close_friend,
                'friendship_id', NEW.id
            )::text
        );
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_friendship_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_message_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF OLD.print_status != NEW.print_status THEN
        PERFORM pg_notify(
            'message_status_update', 
            json_build_object(
                'type', 'print_status_changed',
                'message_id', NEW.id,
                'sender_id', NEW.sender_id,
                'receiver_id', NEW.receiver_id,
                'old_status', OLD.print_status,
                'new_status', NEW.print_status,
                'printed_at', NEW.printed_at
            )::text
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_message_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM pg_notify(
        'new_message', 
        json_build_object(
            'receiver_id', NEW.receiver_id,
            'sender_id', NEW.sender_id,
            'message_id', NEW.id,
            'content', NEW.content,
            'image_url', NEW.image_url,
            'lcd_teaser', NEW.lcd_teaser,
            'created_at', NEW.created_at
        )::text
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_close_friendship"("user1_id" "uuid", "user2_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    affected_rows INTEGER := 0;
BEGIN
    -- 권한 확인
    IF auth.uid() NOT IN (user1_id, user2_id) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized'
        );
    END IF;
    
    -- 양방향 친한친구 관계 해제
    UPDATE public.friendships 
    SET is_close_friend = false, updated_at = CURRENT_TIMESTAMP
    WHERE (
        (user_id = user1_id AND friend_id = user2_id) OR
        (user_id = user2_id AND friend_id = user1_id)
    ) AND status = 'accepted';
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    -- 관련된 친한친구 요청 삭제
    DELETE FROM public.close_friend_requests 
    WHERE (
        (requester_id = user1_id AND target_id = user2_id) OR
        (requester_id = user2_id AND target_id = user1_id)
    );
    
    RETURN json_build_object(
        'success', true,
        'updated_friendships', affected_rows,
        'message', 'Close friend relationship removed successfully'
    );
END;
$$;


ALTER FUNCTION "public"."remove_close_friendship"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."close_friend_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "close_friend_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "no_self_close_friend_request" CHECK (("requester_id" <> "target_id"))
);


ALTER TABLE "public"."close_friend_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friend_id" "uuid" NOT NULL,
    "is_close_friend" boolean DEFAULT false,
    "status" "public"."friendship_status" DEFAULT 'pending'::"public"."friendship_status",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "no_self_friendship" CHECK (("user_id" <> "friend_id"))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "content" "text",
    "image_url" "text",
    "lcd_teaser" character varying(10),
    "print_status" "public"."print_status" DEFAULT 'pending'::"public"."print_status",
    "printed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_or_image" CHECK ((("content" IS NOT NULL) OR ("image_url" IS NOT NULL)))
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."printer_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" character varying(100) NOT NULL,
    "device_name" character varying(100),
    "last_connected_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."printer_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "auto_print_close_friends" boolean DEFAULT false,
    "retro_effects_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "message_notifications" boolean DEFAULT true,
    "marketing_notifications" boolean DEFAULT false,
    "profile_visibility" character varying(20) DEFAULT 'public'::character varying,
    "show_online_status" boolean DEFAULT true,
    CONSTRAINT "check_profile_visibility" CHECK ((("profile_visibility")::"text" = ANY ((ARRAY['public'::character varying, 'friends_only'::character varying, 'private'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "username" character varying(50) NOT NULL,
    "display_name" character varying(100) NOT NULL,
    "avatar_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."close_friend_requests"
    ADD CONSTRAINT "close_friend_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."printer_connections"
    ADD CONSTRAINT "printer_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."close_friend_requests"
    ADD CONSTRAINT "unique_close_friend_request" UNIQUE ("requester_id", "target_id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "unique_friendship" UNIQUE ("user_id", "friend_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE UNIQUE INDEX "unique_active_printer_per_user" ON "public"."printer_connections" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE OR REPLACE TRIGGER "check_auto_approve" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."auto_approve_message"();



CREATE OR REPLACE TRIGGER "on_close_friend_request_insert" AFTER INSERT ON "public"."close_friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_close_friend_request"();



CREATE OR REPLACE TRIGGER "on_close_friend_request_update" AFTER UPDATE ON "public"."close_friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_close_friend_request"();



CREATE OR REPLACE TRIGGER "on_friendship_insert" AFTER INSERT ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."notify_friendship_change"();



CREATE OR REPLACE TRIGGER "on_friendship_update" AFTER UPDATE ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."notify_friendship_change"();



CREATE OR REPLACE TRIGGER "on_message_status_update" AFTER UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_message_status_change"();



CREATE OR REPLACE TRIGGER "on_new_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_message"();



CREATE OR REPLACE TRIGGER "update_close_friend_requests_updated_at" BEFORE UPDATE ON "public"."close_friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_friendships_updated_at" BEFORE UPDATE ON "public"."friendships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_printer_connections_updated_at" BEFORE UPDATE ON "public"."printer_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_settings_updated_at" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."close_friend_requests"
    ADD CONSTRAINT "close_friend_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."close_friend_requests"
    ADD CONSTRAINT "close_friend_requests_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."printer_connections"
    ADD CONSTRAINT "printer_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own close friend requests" ON "public"."close_friend_requests" USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "target_id")));



CREATE POLICY "Users can manage own friendships" ON "public"."friendships" USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "friend_id")));



CREATE POLICY "Users can manage own printers" ON "public"."printer_connections" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own settings" ON "public"."user_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can subscribe to own close friend requests" ON "public"."close_friend_requests" USING ((("auth"."uid"() = "requester_id") OR ("auth"."uid"() = "target_id")));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update received messages" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "receiver_id"));



CREATE POLICY "Users can view all profiles" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can view own messages" ON "public"."messages" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



ALTER TABLE "public"."close_friend_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."printer_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."close_friend_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."friendships";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_settings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."users";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."accept_close_friend_request"("request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_close_friend_request"("request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_close_friend_request"("request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."are_close_friends"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."are_close_friends"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."are_close_friends"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_approve_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_approve_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_approve_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_friendship_status"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_friendship_status"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_friendship_status"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_queued_messages_for_user"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_queued_messages_for_user"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_queued_messages_for_user"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_close_friend_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_close_friend_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_close_friend_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_friendship_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_friendship_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_friendship_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_message_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_message_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_message_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_close_friendship"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_close_friendship"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_close_friendship"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."close_friend_requests" TO "anon";
GRANT ALL ON TABLE "public"."close_friend_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."close_friend_requests" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."printer_connections" TO "anon";
GRANT ALL ON TABLE "public"."printer_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."printer_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
