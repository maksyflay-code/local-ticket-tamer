import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export async function requireAuth() {
  // Skip on SSR — no localStorage means session is always null on server.
  // The client will re-run beforeLoad after hydration.
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/login" });
}


export async function requireAdmin() {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/login" });
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: data.session.user.id,
    _role: "admin",
  });
  if (error || !isAdmin) throw redirect({ to: "/dashboard" });
}