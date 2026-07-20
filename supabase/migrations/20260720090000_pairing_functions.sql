-- pair_with_code: atomic, secure pairing (previously only run ad hoc via the
-- SQL editor — tracked here now so it's part of the repo's migration history).
CREATE OR REPLACE FUNCTION public.pair_with_code(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  partner_id uuid;
  partner_paired uuid;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, paired_with INTO partner_id, partner_paired
  FROM public.profiles
  WHERE upper(trim(partner_code)) = upper(trim(input_code))
  LIMIT 1;

  IF partner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No one has that code');
  END IF;

  IF partner_id = caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot pair with yourself');
  END IF;

  IF partner_paired IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'That person is already paired');
  END IF;

  UPDATE public.profiles SET paired_with = partner_id WHERE id = caller_id;
  UPDATE public.profiles SET paired_with = caller_id WHERE id = partner_id;

  RETURN jsonb_build_object('success', true, 'partner_id', partner_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pair_with_code(text) TO authenticated;

-- unpair_me: self-service escape hatch. Lets a user cleanly unpair themselves
-- (and their partner, symmetrically) without ever needing to touch SQL.
CREATE OR REPLACE FUNCTION public.unpair_me()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  other_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT paired_with INTO other_id FROM public.profiles WHERE id = caller_id;

  UPDATE public.profiles SET paired_with = NULL WHERE id = caller_id;
  IF other_id IS NOT NULL THEN
    UPDATE public.profiles SET paired_with = NULL WHERE id = other_id AND paired_with = caller_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unpair_me() TO authenticated;
