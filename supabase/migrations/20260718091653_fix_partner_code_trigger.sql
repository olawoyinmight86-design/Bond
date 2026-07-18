-- Fix: generate_partner_code needs SECURITY DEFINER + search_path
-- so gen_random_bytes (from pgcrypto in public schema) resolves correctly
-- when called from the handle_new_user trigger context.

CREATE OR REPLACE FUNCTION public.generate_partner_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.partner_code IS NULL THEN
    NEW.partner_code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

-- Keep the updated_at logic in its own trigger (only fires on UPDATE)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
