/*
# Create presence table

## Overview
Creates the `presence` table to track which users are currently online and
their last-seen timestamp. Used to show the partner's online status in the
dashboard. The frontend updates this table periodically via heartbeat.

## New Tables

### presence
- `user_id` (uuid, primary key, references profiles)
- `online` (boolean, default false)
- `last_seen` (timestamptz, default now())

## Security
- RLS enabled on presence.
- Authenticated users can read their own and their partner's presence.
- Users can insert/update only their own presence row.
*/

CREATE TABLE IF NOT EXISTS presence (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_pair_presence" ON presence;
CREATE POLICY "select_pair_presence"
ON presence FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR user_id IN (
    SELECT paired_with FROM profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "insert_own_presence" ON presence;
CREATE POLICY "insert_own_presence"
ON presence FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_presence" ON presence;
CREATE POLICY "update_own_presence"
ON presence FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
