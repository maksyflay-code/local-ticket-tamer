import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/guard";
import { Plus, Search, Trash2, Pencil, Wifi } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/planos")({
  beforeLoad: requireAuth,
  component: PlanosPage,
});

type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  velocidade_download: number | null;
  velocidade_upload: number | null;
  preco: number;
  tipo: string;
  ativo: boolean;
};

const empty: Partial<Plano> = { tipo: "residencial", ativo: true, preco: 0 };

function PlanosPage() {
  const [items, setItems] = useState<Plano[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Plano>>(empty);

  const load = async () => {
    const { data, error } = await supabase.from("planos").select("*").order("preco");
    if (error) toast.error(error.message);
    setItems((data as Plano[]) ?? []);
    const { data: clientes } = await supabase.from("clientes").select("plano_id");
    const c: Record<string, number> = {};
    (clientes ?? []).forEach((cl: { plano_id: string | null }) => {
      if (cl.plano_id) c[cl.plano_id] = (c[cl.plano_id] ?? 0) + 1;
    });
    setCounts(c);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome) return toast.error("Nome obrigatório");
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    const { error } = form.id
      ? await supabase.from("planos").update(payload as never).eq("id", form.id)
      : await supabase.from("planos").insert(payload as never);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Plano atualizado" : "Plano criado");
    setOpen(false); setForm(empty); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este plano? Clientes vinculados ficarão sem plano.")) return;
    const { error } = await supabase.from("planos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plano removido"); load();
  };

  const filtered = items.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell title="Planos & Contratos">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2 border border-border bg-card px-3 py-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plano…"
            className="flex-1 bg-transparent text-sm focus:outline-none font-mono" />
        </div>
        <button onClick={() => { setForm(empty); setOpen(true); }}
          className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo Plano
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full border border-border bg-card p-8 text-center text-muted-foreground font-mono text-sm">
            Nenhum plano cadastrado.
          </div>
        )}
        {filtered.map((p) => (
          <div key={p.id} className="border border-border bg-card p-5 flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" />
                <span className="font-display text-lg font-bold">{p.nome}</span>
              </div>
              <span className={`text-[10px] font-mono uppercase border px-2 py-0.5 ${p.ativo ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/10 text-muted-foreground"}`}>
                {p.ativo ? "ativo" : "inativo"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono uppercase mb-2">{p.tipo}</div>
            {p.descricao && <p className="text-sm text-muted-foreground mb-3">{p.descricao}</p>}
            <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
              <div>
                <div className="text-muted-foreground text-[10px] uppercase">↓ Download</div>
                <div className="text-foreground">{p.velocidade_download ?? "—"} Mbps</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px] uppercase">↑ Upload</div>
                <div className="text-foreground">{p.velocidade_upload ?? "—"} Mbps</div>
              </div>
            </div>
            <div className="mt-auto pt-3 border-t border-border flex justify-between items-center">
              <div>
                <div className="font-display text-2xl font-bold tracking-tight text-primary">
                  R$ {Number(p.preco).toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">{counts[p.id] ?? 0} cliente(s)</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setForm(p); setOpen(true); }} className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-primary">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(p.id)} className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={save} className="bg-card border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="font-display text-lg font-bold">{form.id ? "Editar Plano" : "Novo Plano"}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome *</Label>
                <Input required value={form.nome ?? ""} onChange={(v) => setForm({ ...form, nome: v })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <select value={form.tipo ?? "residencial"} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary">
                  <option value="residencial">Residencial</option>
                  <option value="empresarial">Empresarial</option>
                  <option value="dedicado">Dedicado</option>
                </select>
              </div>
              <div>
                <Label>Preço (R$) *</Label>
                <Input type="number" step="0.01" required value={String(form.preco ?? 0)}
                  onChange={(v) => setForm({ ...form, preco: Number(v) })} />
              </div>
              <div>
                <Label>Download (Mbps)</Label>
                <Input type="number" value={String(form.velocidade_download ?? "")}
                  onChange={(v) => setForm({ ...form, velocidade_download: v ? Number(v) : null })} />
              </div>
              <div>
                <Label>Upload (Mbps)</Label>
                <Input type="number" value={String(form.velocidade_upload ?? "")}
                  onChange={(v) => setForm({ ...form, velocidade_upload: v ? Number(v) : null })} />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              </div>
              <label className="flex items-center gap-2 text-sm font-mono">
                <input type="checkbox" checked={form.ativo ?? true} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Plano ativo
              </label>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground">Cancelar</button>
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:opacity-90">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{children}</label>;
}
function Input({ value, onChange, type = "text", required, step }: { value: string; onChange: (v: string) => void; type?: string; required?: boolean; step?: string }) {
  return <input type={type} step={step} required={required} value={value} onChange={(e) => onChange(e.target.value)}
    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono" />;
}
