import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PREFS, type PrefRow, type HistRow, type NotificationItem } from "./notifications.types";

export const getMyPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as PrefRow | null) ?? { user_id: userId, ...DEFAULT_PREFS };
  });

export const updateMyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        notify_finalizacao: z.boolean().optional(),
        notify_relato: z.boolean().optional(),
        notify_status: z.boolean().optional(),
        push_enabled: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...DEFAULT_PREFS, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        endpoint: z.string().url().max(2000),
        p256dh: z.string().min(1).max(500),
        auth: z.string().min(1).max(500),
        user_agent: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // remove any previous record with the same endpoint (re-subscription)
    await supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      user_agent: data.user_agent ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ endpoint: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", userId);
    return { ok: true };
  });

/* ─────────── Central de notificações ─────────── */

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page: z.number().int().min(0).max(500).default(0),
        pageSize: z.number().int().min(1).max(100).default(20),
        onlyUnread: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const from = data.page * data.pageSize;
    const to = from + data.pageSize - 1;

    // Pega histórico paginado mais recente.
    const { data: hist, count, error } = await supabase
      .from("chamado_historico")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    const rows = (hist ?? []) as HistRow[];

    const ids = rows.map((r) => r.id);
    const chamadoIds = Array.from(new Set(rows.map((r) => r.chamado_id)));

    const [readsRes, chamadosRes] = await Promise.all([
      ids.length
        ? supabase
            .from("notification_reads")
            .select("historico_id")
            .eq("user_id", userId)
            .in("historico_id", ids)
        : Promise.resolve({ data: [] as { historico_id: string }[] }),
      chamadoIds.length
        ? supabase
            .from("chamados")
            .select("id, codigo, numero, titulo")
            .in("id", chamadoIds)
        : Promise.resolve({ data: [] as { id: string; codigo: string | null; numero: number; titulo: string }[] }),
    ]);
    const readSet = new Set((readsRes.data ?? []).map((r) => r.historico_id));
    const chamadoMap = new Map(
      ((chamadosRes.data ?? []) as { id: string; codigo: string | null; numero: number; titulo: string }[]).map(
        (c) => [c.id, c],
      ),
    );

    const items: NotificationItem[] = rows
      .filter((r) => (data.onlyUnread ? !readSet.has(r.id) : true))
      .map((r) => {
        const c = chamadoMap.get(r.chamado_id);
        return {
          ...r,
          read: readSet.has(r.id),
          chamado_codigo: c?.codigo ?? null,
          chamado_numero: c?.numero ?? null,
          chamado_titulo: c?.titulo ?? null,
        };
      });

    return { items, total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [totalRes, readRes] = await Promise.all([
      supabase.from("chamado_historico").select("id", { count: "exact", head: true }),
      supabase
        .from("notification_reads")
        .select("historico_id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);
    const total = totalRes.count ?? 0;
    const read = readRes.count ?? 0;
    return { count: Math.max(0, total - read) };
  });

export const markAsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.ids.map((id) => ({ user_id: userId, historico_id: id }));
    const { error } = await supabase
      .from("notification_reads")
      .upsert(rows, { onConflict: "user_id,historico_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllAsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Pega ids não lidos (limite 1000)
    const { data: hist } = await supabase
      .from("chamado_historico")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1000);
    const ids = (hist ?? []).map((h) => h.id as string);
    if (!ids.length) return { ok: true };
    const { data: existing } = await supabase
      .from("notification_reads")
      .select("historico_id")
      .eq("user_id", userId)
      .in("historico_id", ids);
    const already = new Set((existing ?? []).map((r) => r.historico_id as string));
    const missing = ids.filter((id) => !already.has(id));
    if (!missing.length) return { ok: true };
    const rows = missing.map((id) => ({ user_id: userId, historico_id: id }));
    await supabase.from("notification_reads").insert(rows);
    return { ok: true };
  });
