import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAPID_PUBLIC =
  "BPYLG9Ly9J-cCP4nXoxUbyzM-4VoF02enSHjK-1zLSDdsmGJtAHDzoTJ3NErTIyCq_rgXbrJdV5S0pjhuWwZ1UA";
const VAPID_PRIVATE = "uzx_jtblYHlDKKymVY-gh_ySr4UFKOWmK654sKxo7MY";
const VAPID_SUBJECT = "mailto:no-reply@ivitelecom.local";

let webpushMod: typeof import("web-push") | null = null;
let configured = false;
async function getWebPush() {
  if (webpushMod) return webpushMod;
  // Lazy import so this Node-only lib does not run at module init time
  // (it would crash the whole server-function module otherwise).
  const mod = await import("web-push");
  webpushMod = (mod as unknown as { default?: typeof import("web-push") }).default ?? mod;
  if (!configured) {
    webpushMod.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  }
  return webpushMod;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type PrefKey = "notify_finalizacao" | "notify_relato" | "notify_status";

/**
 * Fan out a push notification to every user that opted-in for the given
 * preference key and that has at least one active push subscription.
 */
export async function fanOutPush(prefKey: PrefKey, payload: PushPayload) {
  let webpush: typeof import("web-push");
  try {
    webpush = await getWebPush();
  } catch (err) {
    console.error("[push] web-push unavailable in this runtime", err);
    return { sent: 0 };
  }

  const { data: prefs, error: prefsErr } = await supabaseAdmin
    .from("notification_preferences")
    .select("user_id, push_enabled, notify_finalizacao, notify_relato, notify_status")
    .eq("push_enabled", true)
    .eq(prefKey, true);

  if (prefsErr || !prefs?.length) return { sent: 0 };

  const userIds = (prefs as { user_id: string }[]).map((p) => p.user_id);

  const { data: subs, error: subsErr } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .in("user_id", userIds);

  if (subsErr || !subs?.length) return { sent: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const toDelete: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) toDelete.push(s.id);
      }
    }),
  );

  if (toDelete.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", toDelete);
  }

  return { sent };
}