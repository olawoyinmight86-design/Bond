ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.edit_message(message_id uuid, new_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  msg RECORD;
BEGIN
  SELECT * INTO msg FROM public.messages WHERE id = message_id;
  IF msg IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Message not found'); END IF;
  IF msg.sender_id != caller THEN RETURN jsonb_build_object('success', false, 'error', 'Not your message'); END IF;
  IF msg.type != 'text' THEN RETURN jsonb_build_object('success', false, 'error', 'Only text messages can be edited'); END IF;
  IF msg.deleted_for_everyone THEN RETURN jsonb_build_object('success', false, 'error', 'Message was deleted'); END IF;

  UPDATE public.messages SET content = new_content, edited_at = now() WHERE id = message_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.edit_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  msg RECORD;
BEGIN
  SELECT * INTO msg FROM public.messages WHERE id = message_id;
  IF msg IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Message not found'); END IF;
  IF msg.sender_id != caller THEN RETURN jsonb_build_object('success', false, 'error', 'Not your message'); END IF;

  UPDATE public.messages
  SET deleted_for_everyone = true, content = '', media_path = NULL, reactions = '{}'::jsonb, pinned = false
  WHERE id = message_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_message_for_everyone(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_pin(message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  msg RECORD;
BEGIN
  SELECT * INTO msg FROM public.messages WHERE id = message_id;
  IF msg IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Message not found'); END IF;
  IF caller != msg.sender_id AND caller != msg.recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your conversation');
  END IF;

  UPDATE public.messages SET pinned = NOT pinned WHERE id = message_id;
  RETURN jsonb_build_object('success', true, 'pinned', NOT msg.pinned);
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_pin(uuid) TO authenticated;
