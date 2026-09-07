import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/ivi-logo.jpeg";
import loginBg from "@/assets/login-bg.jpg";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      toast.success("Bem-vindo de volta!");
      // Hard reload to guarantee a clean app state after sign-in.
      // Avoids white-screen caused by stale providers/realtime channels
      // from a previously expired session.
      if (typeof window !== "undefined") {
        window.location.assign("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de autenticação";
      const friendly = /invalid login credentials/i.test(msg)
        ? "E-mail ou senha incorretos."
        : /email not confirmed/i.test(msg)
          ? "Confirme seu e-mail antes de entrar."
          : msg;
      setError(friendly);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden bg-background">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})` }}
        aria-hidden
      />
      {/* Overlays for depth and readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background/95" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_85%)]" aria-hidden />
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/30 blur-[120px]" aria-hidden />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-primary/20 blur-[120px]" aria-hidden />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/40 blur-2xl rounded-full" aria-hidden />
            <img
              src={logo}
              alt="IVI Telecom"
              className="relative h-24 w-24 rounded-2xl object-cover shadow-2xl shadow-primary/30 ring-1 ring-white/10"
            />
          </div>
          <span className="font-display text-4xl font-extrabold tracking-tighter uppercase bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent drop-shadow-[0_0_25px_hsl(var(--primary)/0.4)]">
            IVI TELECOM
          </span>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-card/40 backdrop-blur-xl p-8 shadow-2xl shadow-black/40">
          {/* Top gradient accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-primary to-transparent" aria-hidden />

          <h1 className="font-display text-2xl font-bold mb-1 text-center">Bem-vindo de volta</h1>
          <p className="text-xs text-muted-foreground font-mono mb-6 text-center">Entre com suas credenciais para continuar</p>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg bg-background/60 border border-border/60 px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono transition-all"
                placeholder="operador@provedor.com"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg bg-background/60 border border-border/60 px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 font-mono transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-3 text-sm font-semibold uppercase tracking-wider shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Processando…" : "Entrar"}
            </button>
          </form>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span>Acesso restrito · IVI Telecom © {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}