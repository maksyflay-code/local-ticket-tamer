import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/guard";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Trash2, Shield, ShieldCheck, Eye, KeyRound } from "lucide-react";
import {
  adminListUsers,
  adminCreateUser,
  adminSetUserRole,
  adminDeleteUser,
  adminResetPassword,
  adminSetUserName,
} from "@/lib/admin-users.functions";
import { authHeaders } from "@/lib/server-call";

export const Route = createFileRoute("/usuarios")({
  beforeLoad: requireAdmin,
  component: UsuariosPage,
});

type Row = Awaited<ReturnType<typeof adminListUsers>>[number];
type Role = "admin" | "operador" | "visualizador";

const roleLabel: Record<Role, string> = {
  admin: "Administrador",
  operador: "Operador",
  visualizador: "Visualizador",
};

const roleIcon = (r: Role | null) =>
  r === "admin" ? <ShieldCheck className="h-3.5 w-3.5 text-primary" /> :
  r === "operador" ? <Shield className="h-3.5 w-3.5 text-emerald-400" /> :
  <Eye className="h-3.5 w-3.5 text-muted-foreground" />;

function UsuariosPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "operador" as Role, name: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminListUsers({ headers: await authHeaders() });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminCreateUser({
        data: { ...form, name: form.name.trim() || null },
        headers: await authHeaders(),
      });
      toast.success("Usuário criado");
      setOpen(false);
      setForm({ email: "", password: "", role: "operador", name: "" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (userId: string, role: Role) => {
    try {
      await adminSetUserRole({ data: { userId, role }, headers: await authHeaders() });
      toast.success("Permissão atualizada");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const remove = async (userId: string) => {
    if (!confirm("Excluir este usuário?")) return;
    try {
      await adminDeleteUser({ data: { userId }, headers: await authHeaders() });
      toast.success("Usuário excluído");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const resetPwd = async (userId: string, email: string) => {
    const pwd = prompt(`Nova senha para ${email} (mín. 8 caracteres):`);
    if (!pwd) return;
    if (pwd.length < 8) {
      toast.error("Senha precisa ter ao menos 8 caracteres");
      return;
    }
    try {
      await adminResetPassword({ data: { userId, password: pwd }, headers: await authHeaders() });
      toast.success("Senha redefinida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const editName = async (userId: string, current: string | null, email: string) => {
    const value = prompt(`Nome completo de ${email}:`, current ?? "");
    if (value === null) return;
    try {
      await adminSetUserName({ data: { userId, name: value.trim() || null }, headers: await authHeaders() });
      toast.success("Nome atualizado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <AppShell title="Usuários & Permissões">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase">Gestão de acesso</p>
          <h2 className="font-display text-2xl font-bold">Operadores do sistema</h2>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo usuário
        </button>
      </div>

      <div className="border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30">
            <tr className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Permissão</th>
              <th className="text-left px-4 py-3">Último acesso</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => editName(r.id, r.name, r.email)}
                    className="text-left hover:text-primary"
                    title="Editar nome"
                  >
                    {r.name || <span className="text-muted-foreground italic">— sem nome —</span>}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.email}{r.id === user?.id && <span className="ml-2 text-[10px] text-primary">(você)</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {roleIcon(r.role as Role | null)}
                    <select
                      value={r.role ?? ""}
                      onChange={(e) => changeRole(r.id, e.target.value as Role)}
                      disabled={r.id === user?.id}
                      className="bg-background border border-border px-2 py-1 text-xs font-mono"
                    >
                      {!r.role && <option value="">— sem permissão —</option>}
                      <option value="admin">{roleLabel.admin}</option>
                      <option value="operador">{roleLabel.operador}</option>
                      <option value="visualizador">{roleLabel.visualizador}</option>
                    </select>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => resetPwd(r.id, r.email)}
                    className="p-2 text-muted-foreground hover:text-primary"
                    title="Redefinir senha"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    disabled={r.id === user?.id}
                    className="p-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {(["admin", "operador", "visualizador"] as Role[]).map((r) => (
          <div key={r} className="border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              {roleIcon(r)}
              <span className="font-display font-bold uppercase text-sm">{roleLabel[r]}</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              {r === "admin" && "Acesso total: gerencia usuários, exclui registros e configura o sistema."}
              {r === "operador" && "Cria e edita clientes, planos e chamados. Não exclui registros nem gerencia usuários."}
              {r === "visualizador" && "Somente leitura: consulta clientes, planos, chamados e relatórios."}
            </p>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md p-6">
            <h3 className="font-display text-lg font-bold mb-4">Novo usuário</h3>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Nome completo</label>
                <input
                  type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Email</label>
                <input
                  type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Senha (mín. 8)</label>
                <input
                  type="text" required minLength={8} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Permissão</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono"
                >
                  <option value="admin">Administrador</option>
                  <option value="operador">Operador</option>
                  <option value="visualizador">Visualizador</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm border border-border">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground font-semibold uppercase tracking-wider disabled:opacity-50">
                  {saving ? "Criando…" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}