import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { requireAuth } from "@/lib/guard";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Shield, Eye, KeyRound, Mail, User } from "lucide-react";

export const Route = createFileRoute("/perfil")({
  beforeLoad: requireAuth,
  component: PerfilPage,
});

function PerfilPage() {
  const { user, role } = useAuth();
  const [pwd, setPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Senha precisa ter ao menos 8 caracteres");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Senha atualizada");
      setPwd("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const RoleBadge = () => {
    if (role === "admin") return <span className="inline-flex items-center gap-1 text-xs font-mono uppercase bg-primary/10 text-primary px-2 py-1"><ShieldCheck className="h-3 w-3" /> Administrador</span>;
    if (role === "operador") return <span className="inline-flex items-center gap-1 text-xs font-mono uppercase bg-emerald-500/10 text-emerald-400 px-2 py-1"><Shield className="h-3 w-3" /> Operador</span>;
    if (role === "visualizador") return <span className="inline-flex items-center gap-1 text-xs font-mono uppercase bg-muted text-muted-foreground px-2 py-1"><Eye className="h-3 w-3" /> Visualizador</span>;
    return <span className="text-xs font-mono uppercase text-muted-foreground">Sem permissão</span>;
  };

  return (
    <AppShell title="Meu perfil">
      <div className="max-w-2xl space-y-6">
        <div className="border border-border bg-card p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="font-display text-lg font-bold">{user?.email}</div>
              <div className="mt-1"><RoleBadge /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border text-sm">
            <div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground">ID do usuário</div>
              <div className="font-mono text-xs mt-1 truncate">{user?.id}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground">Conta criada</div>
              <div className="font-mono text-xs mt-1">{user?.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "—"}</div>
            </div>
          </div>
        </div>

        <div className="border border-border bg-card p-6">
          <h3 className="font-display font-bold mb-1 flex items-center gap-2"><KeyRound className="h-4 w-4" /> Alterar senha</h3>
          <p className="text-xs text-muted-foreground font-mono mb-4">Mínimo 8 caracteres.</p>
          <form onSubmit={changePwd} className="flex gap-2">
            <input
              type="password" minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)}
              placeholder="Nova senha"
              className="flex-1 bg-background border border-border px-3 py-2 text-sm font-mono"
            />
            <button disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground font-semibold uppercase tracking-wider disabled:opacity-50">
              {saving ? "…" : "Salvar"}
            </button>
          </form>
        </div>

        <div className="border border-border bg-card p-6">
          <h3 className="font-display font-bold mb-3 flex items-center gap-2"><Mail className="h-4 w-4" /> O que você pode fazer</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><span className="text-primary">›</span> Visualizar clientes, planos, chamados e relatórios</li>
            {(role === "admin" || role === "operador") && (
              <li className="flex gap-2"><span className="text-primary">›</span> Criar e editar clientes, planos e chamados</li>
            )}
            {role === "admin" && (
              <>
                <li className="flex gap-2"><span className="text-primary">›</span> Excluir registros</li>
                <li className="flex gap-2"><span className="text-primary">›</span> Gerenciar usuários e permissões</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}