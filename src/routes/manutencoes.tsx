import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/guard";
import { Plus, Pencil, Trash2, Wrench, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { notifyManutencaoAgendada } from "@/lib/manutencoes.functions";

export const Route = createFileRoute("/manutencoes")({
  beforeLoad: requireAuth,
  component: ManutencoesPage,
});

type Manutencao = {
  id: string;
  operadora: string;
  trecho: string;
  data_inicio: string;
  data_fim: string | null;
  descricao: string | null;
  created_at: string;
};

const empty: Partial<Manutencao> = { operadora: "", trecho: "", data_inicio: "", data_fim: "", descricao: "" };

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ManutencoesPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Manutencao[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Manutencao>>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("manutencoes_programadas" as never)
      .select("*")
      .order("data_inicio", { ascending: true });
    if (error) return toast.error(error.message);
    setItems((data as unknown as Manutencao[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((m) =>
      m.operadora.toLowerCase().includes(s) ||
      m.trecho.toLowerCase().includes(s) ||
      (m.descricao ?? "").toLowerCase().includes(s),
    );
  }, [items, search]);

  const reset = () => { setForm(empty); setEditId(null); };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.operadora?.trim() || !form.trecho?.trim() || !form.data_inicio) {
      return toast.error("Operadora, trecho e data são obrigatórios.");
    }
    setLoading(true);
    const payload = {
      operadora: form.operadora.trim(),
      trecho: form.trecho.trim(),
      data_inicio: new Date(form.data_inicio).toISOString(),
      data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
      descricao: form.descricao?.trim() || null,
    };
    const res = editId
      ? await supabase.from("manutencoes_programadas" as never).update(payload as never).eq("id", editId)
      : await supabase.from("manutencoes_programadas" as never).insert(payload as never);
    setLoading(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editId ? "Manutenção atualizada." : "Manutenção cadastrada.");
    if (!editId) {
      try {
        const r = await notifyManutencaoAgendada({ data: {
          operadora: payload.operadora,
          trecho: payload.trecho,
          data_inicio: payload.data_inicio,
          data_fim: payload.data_fim,
          descricao: payload.descricao,
        }});
        if (r?.ok) toast.success("Alerta enviado no Telegram.");
        else if (r?.error) toast.error(`Telegram: ${r.error}`);
      } catch (e) {
        toast.error(`Telegram: ${(e as Error).message}`);
      }
    }
    setOpen(false); reset(); load();
  };

  const onEdit = (m: Manutencao) => {
    setEditId(m.id);
    setForm({
      operadora: m.operadora,
      trecho: m.trecho,
      data_inicio: toLocalInput(m.data_inicio),
      data_fim: toLocalInput(m.data_fim),
      descricao: m.descricao ?? "",
    });
    setOpen(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir esta manutenção programada?")) return;
    const { error } = await supabase.from("manutencoes_programadas" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída.");
    load();
  };

  const now = Date.now();
  const statusOf = (m: Manutencao) => {
    const ini = new Date(m.data_inicio).getTime();
    const fim = m.data_fim ? new Date(m.data_fim).getTime() : ini + 3600_000;
    if (now < ini) return { label: "Agendada", cls: "border-sky-500/30 bg-sky-500/10 text-sky-400" };
    if (now >= ini && now <= fim) return { label: "Em andamento", cls: "border-amber-500/30 bg-amber-500/10 text-amber-400" };
    return { label: "Concluída", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" };
  };

  return (
    <AppShell title="Manutenção Programada">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" /> Manutenção Programada
            </h1>
            <p className="text-sm text-muted-foreground">Cadastre manutenções de operadoras com trecho e data.</p>
          </div>
          <button
            onClick={() => { reset(); setOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-mono uppercase tracking-widest hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Nova manutenção
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por operadora, trecho..."
            className="w-full pl-10 pr-4 py-2 bg-card border border-border text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-3">Operadora</th>
                <th className="text-left p-3">Trecho</th>
                <th className="text-left p-3">Início</th>
                <th className="text-left p-3">Fim</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma manutenção cadastrada.</td></tr>
              ) : filtered.map((m) => {
                const st = statusOf(m);
                return (
                  <tr key={m.id} className="border-b border-border/60 hover:bg-secondary/30">
                    <td className="p-3 font-medium">{m.operadora}</td>
                    <td className="p-3">{m.trecho}</td>
                    <td className="p-3 tabular-nums">{fmt(m.data_inicio)}</td>
                    <td className="p-3 tabular-nums">{fmt(m.data_fim)}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => onEdit(m)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => onDelete(m.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold mb-4">{editId ? "Editar" : "Nova"} manutenção programada</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Operadora *</label>
                <input value={form.operadora ?? ""} onChange={(e) => setForm({ ...form, operadora: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-primary" required />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Trecho *</label>
                <input value={form.trecho ?? ""} onChange={(e) => setForm({ ...form, trecho: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-primary" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Data início *</label>
                  <input type="datetime-local" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-primary" required />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Data fim</label>
                  <input type="datetime-local" value={form.data_fim ?? ""} onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Descrição</label>
                <textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  rows={3} className="w-full mt-1 px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-mono uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50">
                  {loading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}