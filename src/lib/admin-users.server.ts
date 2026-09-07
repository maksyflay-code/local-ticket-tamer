import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminRole = "admin" | "operador" | "visualizador";

const ADMIN_CONFIG_MESSAGE =
  "Configuração inválida na hospedagem: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY com a Service Role Key correta, reinicie o servidor e publique novamente.";

function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function ensureAdminConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) throw new Error(ADMIN_CONFIG_MESSAGE);

  const payload = decodeJwtPayload(serviceRoleKey);
  if (payload?.role && payload.role !== "service_role") {
    throw new Error(`${ADMIN_CONFIG_MESSAGE} A chave atual não é uma Service Role Key.`);
  }
}

function adminError(error: { message?: string }) {
  if (/invalid api key/i.test(error.message ?? "")) {
    return new Error(ADMIN_CONFIG_MESSAGE);
  }
  return new Error(error.message ?? "Erro administrativo inesperado.");
}

export async function assertAdmin(userId: string) {
  ensureAdminConfig();

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw adminError(error);
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

export async function listAdminUsers() {
  ensureAdminConfig();

  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw adminError(error);

  const ids = users.users.map((u) => u.id);
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const map = new Map<string, string>();
  (roles ?? []).forEach((r) => map.set(r.user_id, r.role));

  return users.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    name:
      ((u.user_metadata as { full_name?: string; name?: string } | null)?.full_name ??
        (u.user_metadata as { full_name?: string; name?: string } | null)?.name ??
        "") || null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    role: (map.get(u.id) as AdminRole | undefined) ?? null,
  }));
}

export async function createAdminUser(data: { email: string; password: string; role: AdminRole; name?: string | null }) {
  ensureAdminConfig();

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: data.name ? { full_name: data.name } : undefined,
  });
  if (error) throw adminError(error);
  if (!created.user) throw new Error("Falha ao criar usuário");

  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: created.user.id, role: data.role });
  if (roleError) throw new Error(roleError.message);

  return { id: created.user.id };
}

export async function setAdminUserRole(data: { userId: string; role: AdminRole }) {
  ensureAdminConfig();

  await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
  const { error } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: data.userId, role: data.role });
  if (error) throw adminError(error);
  return { ok: true };
}

export async function deleteAdminUser(userId: string) {
  ensureAdminConfig();

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw adminError(error);
  return { ok: true };
}

export async function resetAdminUserPassword(data: { userId: string; password: string }) {
  ensureAdminConfig();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
    password: data.password,
  });
  if (error) throw adminError(error);
  return { ok: true };
}

export async function setAdminUserName(data: { userId: string; name: string | null }) {
  ensureAdminConfig();

  const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
  if (getErr) throw adminError(getErr);

  const meta = (existing.user?.user_metadata as Record<string, unknown> | null) ?? {};
  const next = { ...meta, full_name: data.name ?? "" };

  const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
    user_metadata: next,
  });
  if (error) throw adminError(error);
  return { ok: true };
}

export async function listAssignableOperatorUsers() {
  ensureAdminConfig();

  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "operador"]);
  if (error) throw adminError(error);

  const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
  if (ids.length === 0) return [] as { id: string; email: string; role: string }[];

  const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (usersError) throw adminError(usersError);

  const roleByUser = new Map<string, string>();
  (roles ?? []).forEach((r) => roleByUser.set(r.user_id, r.role));

  return users.users
    .filter((u) => ids.includes(u.id))
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name:
        ((u.user_metadata as { full_name?: string; name?: string } | null)?.full_name ??
          (u.user_metadata as { full_name?: string; name?: string } | null)?.name ??
          "") || null,
      role: roleByUser.get(u.id) ?? "",
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function listAllAssignableUsers() {
  ensureAdminConfig();

  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw adminError(error);

  const ids = users.users.map((u) => u.id);
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const roleByUser = new Map<string, string>();
  (roles ?? []).forEach((r) => roleByUser.set(r.user_id, r.role));

  return users.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name:
        ((u.user_metadata as { full_name?: string; name?: string } | null)?.full_name ??
          (u.user_metadata as { full_name?: string; name?: string } | null)?.name ??
          "") || null,
      role: roleByUser.get(u.id) ?? "",
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}