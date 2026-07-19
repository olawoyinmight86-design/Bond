# Setting up offline messaging + push notifications

## 1. Pairing fix + offline messaging (required)

In Supabase → SQL Editor, run **both** migration files, in this order:
1. The `pair_with_code` function you already have from before
2. `supabase/migrations/20260719100000_offline_media_and_push.sql`

That's it — offline text, photos, voice notes, and drawings all work immediately
after this. No further setup needed for that part.

## 2. Push notifications (optional, ~10 minutes)

This is what makes a note show up as a notification even when the app is closed.

### a) Generate VAPID keys
```
npx web-push generate-vapid-keys
```
This prints a public and private key. Keep both.

### b) Add the public key to Vercel
Vercel → your project → Settings → Environment Variables:
- `VITE_VAPID_PUBLIC_KEY` = (the public key)

Redeploy after adding it.

### c) Deploy the edge function
```
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy send-push
npx supabase secrets set VAPID_PUBLIC_KEY=<public key>
npx supabase secrets set VAPID_PRIVATE_KEY=<private key>
npx supabase secrets set VAPID_SUBJECT=mailto:you@example.com
```

### d) Point the database trigger at your deployed function
In SQL Editor:
```sql
ALTER DATABASE postgres SET app.send_push_url = 'https://<your-project-ref>.functions.supabase.co/send-push';
ALTER DATABASE postgres SET app.service_role_key = '<your service role key, from Settings > API>';
```

### e) Turn it on in the app
Call `enablePushNotifications(profile.id)` from `src/lib/push.ts` — the natural
place is a button on the Settings screen ("Enable notifications"). I left this
as a manual opt-in rather than wiring it in automatically, since browsers
require an explicit user tap to grant notification permission — it can't be
done silently on page load.

## Notes
- True zero-connectivity, phone-to-phone sync isn't possible for two separate
  devices — messages always route through Supabase. What's implemented is the
  strongest real version of "offline": compose anytime with no signal, and it
  delivers itself automatically the instant either phone reconnects.
- Storage bucket `chat-media` is private; only you and your paired partner can
  read each other's uploads (enforced by the `is_partner()` RLS check).
