/*
# Offline media messages + push notifications

## Overview
Extends `messages` to support photo, voice, and drawing attachments (not just
text), adds a `client_id` for idempotent offline sync (so a message queued
offline and retried never gets inserted twice), adds a private storage
bucket for chat media, and adds `push_subscriptions` so partners can be
notified the instant a message arrives, even if the app is closed.

## Changes
- messages: + type, media_path, duration_ms, client_id (unique per sender)
- storage bucket: chat-media (private — access gated by pairing)
- new table: push_subscriptions
- new function: is_partner(uuid) — used by storage RLS
- new table: (none other)

## Security
- Storage RLS mirrors the pairing model: you can read your own uploads and
  your paired partner's uploads only.
- push_subscriptions: users can only manage their own subscription row.
*/

-- 1. Extend messages for media types
ALTER TABLE messages ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text'
  CHECK (type IN ('text', 'photo', 'voice', 'drawing'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_path text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_id uuid;

-- content is allowed to be empty for pure media messages
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE messages ALTER COLUMN content SET DEFAULT '';

-- Prevents duplicate inserts if an offline message is retried after
-- actually having succeeded (e.g. the success response never made it back
-- to the phone before it lost signal again).
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client
  ON messages(sender_id, client_id) WHERE client_id IS NOT NULL;

-- 2. Helper used by storage RLS: is the given user my paired partner?
CREATE OR REPLACE FUNCTION public.is_partner(other_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND paired_with = other_id
  );
$$;

-- 3. Private storage bucket for photos / voice notes / drawings
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- Files are uploaded under a path like: {sender_id}/{uuid}.{ext}
DROP POLICY IF EXISTS "read own or partner chat media" ON storage.objects;
CREATE POLICY "read own or partner chat media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_partner(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS "upload own chat media" ON storage.objects;
CREATE POLICY "upload own chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Push subscriptions (Web Push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage own push subscription" ON push_subscriptions;
CREATE POLICY "manage own push subscription"
ON push_subscriptions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. Notify the recipient's device the instant a message lands.
-- Requires the pg_net extension (enabled by default on Supabase) and the
-- SEND_PUSH_URL + SERVICE_ROLE_KEY to be set below after you deploy the
-- send-push edge function (see PUSH_SETUP.md).
CREATE EXTENSION IF NOT EXISTS pg_net;

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
      'recipient_id', NEW.recipient_id,
      'sender_id', NEW.sender_id,
      'type', NEW.type
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block message delivery because a push notification failed
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message_notify ON messages;
CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
