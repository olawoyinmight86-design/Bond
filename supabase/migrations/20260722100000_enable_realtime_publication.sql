/*
Every screen that uses supabase.channel(...).on('postgres_changes', ...) —
chat, presence/online status, pairing status, Truth or Dare / This or That,
Duo Photo, Love Letters, Bucket List, Timeline — depends on the table being
part of the `supabase_realtime` publication. New tables are NOT added to
this automatically; it has to be done explicitly (either here or via the
Supabase dashboard's Database > Replication toggle). Without this, those
`.on('postgres_changes', ...)` subscriptions are wired up correctly in code
but simply never receive anything — which is almost certainly why Truth or
Dare and other "live" features weren't actually updating in real time.
*/
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'messages', 'presence', 'timeline',
    'game_sessions', 'duo_photos', 'love_letters', 'bucket_list_items'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
