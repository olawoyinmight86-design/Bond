-- Fix: gen_random_bytes is in the "extensions" schema, not "public"
CREATE OR REPLACE FUNCTION public.generate_partner_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.partner_code IS NULL THEN
    NEW.partner_code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;
