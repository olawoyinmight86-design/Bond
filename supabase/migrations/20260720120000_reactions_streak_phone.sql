-- Message reactions (tap-react on any message)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.toggle_reaction(message_id uuid, emoji text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  msg RECORD;
  new_reactions jsonb;
BEGIN
  SELECT * INTO msg FROM public.messages WHERE id = message_id;

  IF msg IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message not found');
  END IF;

  IF caller_id != msg.sender_id AND caller_id != msg.recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your conversation');
  END IF;

  -- One reaction per person per message; tapping the same emoji again clears it.
  IF msg.reactions ->> caller_id::text = emoji THEN
    new_reactions := msg.reactions - caller_id::text;
  ELSE
    new_reactions := msg.reactions || jsonb_build_object(caller_id::text, emoji);
  END IF;

  UPDATE public.messages SET reactions = new_reactions WHERE id = message_id;

  RETURN jsonb_build_object('success', true, 'reactions', new_reactions);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_reaction(uuid, text) TO authenticated;

-- Streak: consecutive days (up to today) with at least one message exchanged.
-- Doesn't break the streak just because today hasn't happened yet.
CREATE OR REPLACE FUNCTION public.get_streak()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  partner_id uuid;
  streak int := 0;
  d date := CURRENT_DATE;
  has_activity boolean;
BEGIN
  SELECT paired_with INTO partner_id FROM public.profiles WHERE id = caller_id;
  IF partner_id IS NULL THEN RETURN 0; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.messages
    WHERE ((sender_id = caller_id AND recipient_id = partner_id) OR (sender_id = partner_id AND recipient_id = caller_id))
    AND created_at::date = d
  ) INTO has_activity;
  IF NOT has_activity THEN d := d - 1; END IF;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.messages
      WHERE ((sender_id = caller_id AND recipient_id = partner_id) OR (sender_id = partner_id AND recipient_id = caller_id))
      AND created_at::date = d
    ) INTO has_activity;
    EXIT WHEN NOT has_activity;
    streak := streak + 1;
    d := d - 1;
  END LOOP;

  RETURN streak;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_streak() TO authenticated;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_preview text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_sender_id uuid;

-- Optional phone number, used only for the "send as text" fallback when a
-- message has been stuck offline for a while and cell signal (but not data)
-- is available.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;
