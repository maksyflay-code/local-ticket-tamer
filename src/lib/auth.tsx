import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "operador" | "visualizador";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  canWrite: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  sessionExpiresAt: number | null;
  extendSession: () => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  role: null,
  loading: true,
  isAdmin: false,
  canWrite: false,
  signOut: async () => {},
  refreshRole: async () => {},
  sessionExpiresAt: null,
  extendSession: () => {},
});

const RANK: Record<AppRole, number> = { admin: 3, operador: 2, visualizador: 1 };

const MAX_SESSION_MS = 4 * 60 * 60 * 1000; // 4 hours
const SESSION_START_KEY = "ivi.session.startedAt";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  const loadRole = async (userId: string | undefined) => {
    if (!userId) {
      setRole(null);
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!data || data.length === 0) {
      setRole(null);
      return;
    }
    const top = data
      .map((r) => r.role as AppRole)
      .sort((a, b) => RANK[b] - RANK[a])[0];
    setRole(top);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (typeof window !== "undefined") {
        if (event === "SIGNED_IN" && s) {
          const now = Date.now();
          localStorage.setItem(SESSION_START_KEY, String(now));
          setSessionStartedAt(now);
        } else if (event === "SIGNED_OUT") {
          localStorage.removeItem(SESSION_START_KEY);
          setSessionStartedAt(null);
        }
      }
      // defer to avoid deadlock
      setTimeout(() => loadRole(s?.user?.id), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      loadRole(data.session?.user?.id);
      if (typeof window !== "undefined" && data.session) {
        const existing = localStorage.getItem(SESSION_START_KEY);
        if (!existing) {
          const now = Date.now();
          localStorage.setItem(SESSION_START_KEY, String(now));
          setSessionStartedAt(now);
        } else {
          setSessionStartedAt(Number(existing));
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 4-hour auto logout
  useEffect(() => {
    if (!session || typeof window === "undefined" || !sessionStartedAt) return;
    const remaining = MAX_SESSION_MS - (Date.now() - sessionStartedAt);
    if (remaining <= 0) {
      supabase.auth.signOut();
      return;
    }
    const t = setTimeout(() => {
      supabase.auth.signOut();
    }, remaining);
    return () => clearTimeout(t);
  }, [session, sessionStartedAt]);

  const extendSession = () => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    localStorage.setItem(SESSION_START_KEY, String(now));
    setSessionStartedAt(now);
  };

  const sessionExpiresAt = sessionStartedAt ? sessionStartedAt + MAX_SESSION_MS : null;

  const isAdmin = role === "admin";
  const canWrite = role === "admin" || role === "operador";

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        role,
        loading,
        isAdmin,
        canWrite,
        signOut: async () => {
          await supabase.auth.signOut();
        },
        refreshRole: async () => loadRole(session?.user?.id),
        sessionExpiresAt,
        extendSession,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);