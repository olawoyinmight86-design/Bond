-- Adds the message's own id to the push notification payload, needed for
-- the "Mark as read" notification action button to know which message to
-- update. Redefining the function is enough — the trigger already calls it
-- by name, no need to recreate the trigger itself.
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.send_push_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'message_id', NEW.id,
      'recipient_id', NEW.recipient_id,
      'sender_id', NEW.sender_id,
      'type', NEW.type,
      'content', NEW.content,
      'media_path', NEW.media_path
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
