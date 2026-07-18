/*
# Create messages table

## Overview
Creates the `messages` table for private 1:1 chat between paired partners.
Messages are lightweight — text only, no media — to keep the app small.

## New Tables

### messages
- `id` (uuid, primary key)
- `sender_id` (uuid, not null, references profiles)
- `recipient_id` (uuid, not null, references profiles)
- `content` (text, not null)
- `read_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on messages.
- Users can only see messages they sent or received.
- Users can insert only messages where they are the sender.
- Users can update read_at only on messages they received.
- Users can delete only their own sent messages.
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON messages;
CREATE POLICY "select_own_messages"
ON messages FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_messages" ON messages;
CREATE POLICY "insert_own_messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "update_own_messages" ON messages;
CREATE POLICY "update_own_messages"
ON messages FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_messages" ON messages;
CREATE POLICY "delete_own_messages"
ON messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at DESC);
