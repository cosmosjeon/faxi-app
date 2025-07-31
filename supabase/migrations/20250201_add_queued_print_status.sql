-- Add 'queued' status to print_status enum for close friend auto-print queue
-- This status represents messages from close friends waiting for printer connection

BEGIN;

-- Alter the existing print_status enum to add 'queued' status
ALTER TYPE print_status ADD VALUE IF NOT EXISTS 'queued';

-- Create function to get queued messages for auto-print
CREATE OR REPLACE FUNCTION get_queued_messages_for_user(user_id_param UUID)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    receiver_id UUID,
    content TEXT,
    image_url TEXT,
    lcd_teaser VARCHAR(10),
    print_status print_status,
    created_at TIMESTAMP WITH TIME ZONE,
    sender_display_name VARCHAR(100),
    sender_avatar_url TEXT
) AS $$
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
        sender.display_name as sender_display_name,
        sender.avatar_url as sender_avatar_url
    FROM messages m
    JOIN users sender ON m.sender_id = sender.id
    WHERE m.receiver_id = user_id_param 
      AND m.print_status = 'queued'
    ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policy for the new function
ALTER FUNCTION get_queued_messages_for_user(UUID) OWNER TO postgres;

COMMIT;