/*
# Create timeline table

## Overview
Creates the `timeline` table where paired users post shared moments — notes,
moods, photos, and milestones. Both partners see all entries from their pair.

## New Tables

### timeline
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references profiles)
- `pair_id` (uuid, not null — the paired_with value at creation time, used for filtering)
- `type` (text, not null — one of 'note', 'mood', 'photo', 'milestone')
- `content` (text, not null)
- `mood` (text, nullable — emoji for mood entries)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on timeline.
- Authenticated users can only see entries where they are the author OR the
  author's partner (pair_id = their own id, or user_id = their own id).
- Users can insert/update/delete only their own entries.
*/

CREATE TABLE IF NOT EXISTS timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pair_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('note', 'mood', 'photo', 'milestone')),
  content text NOT NULL,
  mood text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE timeline ENABLE ROW LEVEL SECURITY;

-- Select: author or partner of author
DROP POLICY IF EXISTS "select_pair_timeline" ON timeline;
CREATE POLICY "select_pair_timeline"
ON timeline FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR pair_id = auth.uid()
);

-- Insert: only own entries, pair_id must be own id or partner's id
DROP POLICY IF EXISTS "insert_own_timeline" ON timeline;
CREATE POLICY "insert_own_timeline"
ON timeline FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Update: only own entries
DROP POLICY IF EXISTS "update_own_timeline" ON timeline;
CREATE POLICY "update_own_timeline"
ON timeline FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Delete: only own entries
DROP POLICY IF EXISTS "delete_own_timeline" ON timeline;
CREATE POLICY "delete_own_timeline"
ON timeline FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_timeline_pair_id ON timeline(pair_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created_at ON timeline(created_at DESC);
