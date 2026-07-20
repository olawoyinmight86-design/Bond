// Supabase Edge Function: send-push
// Called by the `on_new_message_notify` DB trigger whenever a message is
// inserted. Looks up the recipient's push subscription(s) and sends a Web
// Push notification, which arrives even if their app is fully closed.
//
// Deploy: supabase functions deploy send-push
// Secrets needed (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (usually already present)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@example.com';

webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

Deno.serve(async (req) => {
  try {
    const { recipient_id, sender_id, type, content, media_path } = await req.json();

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', recipient_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', sender_id)
      .maybeSingle();

    const label = type === 'photo' ? 'sent you a photo 📸'
      : type === 'voice' ? 'sent you a voice note 🎙️'
      : type === 'drawing' ? 'drew you something ✍️'
      : `says: "${(content ?? '').slice(0, 80)}"`;

    let image: string | undefined;
    if (type === 'photo' && media_path) {
      const { data: signed } = await supabase.storage.from('chat-media').createSignedUrl(media_path, 60 * 60);
      image = signed?.signedUrl;
    }

    const payload = JSON.stringify({
      title: sender?.display_name ?? 'Bond',
      body: `${sender?.display_name ?? 'Your partner'} ${label}`,
      url: '/chat',
      image,
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err) {
        // Subscription likely expired — remove it so we stop retrying it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
