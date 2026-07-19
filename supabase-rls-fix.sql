-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Policy 1: Allow anyone to read all profiles (needed for pairing)
CREATE POLICY "Anyone can read all profiles for pairing"
  ON public.profiles FOR SELECT
  USING (true);

-- Policy 2: Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can only update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: Users cannot delete profiles (optional - extra security)
CREATE POLICY "Users cannot delete profiles"
  ON public.profiles FOR DELETE
  USING (false);
