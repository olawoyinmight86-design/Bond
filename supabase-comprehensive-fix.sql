-- Fix 1: Update RLS Policies for public access to partner codes
DROP POLICY IF EXISTS "Anyone can read all profiles for pairing" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Policy 1: Allow anyone to read all profiles (needed for pairing)
CREATE POLICY "Anyone can read all profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- Policy 2: Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can only update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Fix 2: Ensure profiles exist for all auth users
-- Run this to create profiles for users that don't have them
INSERT INTO public.profiles (id, email, partner_code)
SELECT 
  au.id,
  au.email,
  UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 6)) as partner_code
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id);

-- Verify it worked
SELECT 'Profiles created/verified' as status, COUNT(*) as total_profiles FROM public.profiles;
SELECT id, email, partner_code, paired_with FROM public.profiles ORDER BY created_at DESC;
