import { supabase } from "@/integrations/supabase/client";

/**
 * Returns request headers with the current Supabase access token,
 * so server functions protected by `requireSupabaseAuth` receive
 * `Authorization: Bearer <token>`.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}