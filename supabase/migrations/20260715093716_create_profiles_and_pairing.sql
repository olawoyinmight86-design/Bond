/*
# Create profiles table and pairing system

## Overview
Creates the core `profiles` table for Bond — a private space for two people.
Each user has a profile with a partner code they can share. When another user
enters that code, the two accounts are paired together.

## New Tables

### profiles
- `id` (uuid, primary key, references auth.users)
- `email` (text, not null)
- `display_name` (text, nullable — set during onboarding)
- `avatar_emoji` (text, nullable — emoji chosen during onboarding)
- `partner_code` (text, unique, nullable — 6-char code for pairing)
- `paired_with` (uuid, nullable — references profiles.id of partner)
- `onboarding_complete` (boolean, default false)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now)

## Security
- RLS enabled on profiles.
- Each authenticated user can SELECT, INSERT, UPDATE their own row only.
- No DELETE — profiles are permanent.
- Partner codes are visible to authenticated users so pairing works.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  avatar_emoji text,
  partner_code text UNIQUE,
  paired_with uuid REFERENCES profiles(id) ON DELETE SET NULL,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Each user can read their own profile AND their partner's profile (for pairing)
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR auth.uid() = paired_with);

-- Users can insert their own profile row
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Index for partner code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_partner_code ON profiles(partner_code) WHERE partner_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_paired_with ON profiles(paired_with) WHERE paired_with IS NOT NULL;

-- Auto-generate partner code on insert if not provided
CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.partner_code IS NULL THEN
    NEW.partner_code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6));
  END IF;
  IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_partner_code ON profiles;
CREATE TRIGGER trg_profiles_partner_code
BEFORE INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION generate_partner_code();

-- Update updated_at on row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
