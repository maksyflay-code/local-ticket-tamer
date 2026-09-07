import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/guard";
import { Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { monthWindow, downtimeByCliente, uptimePct, fmtUptime, isNonDowntimeTipo, type ChamadoUptime } from "@/lib/uptime";

export const Route = createFileRoute("/clientes")({
  beforeLoad: requireAuth,
  component: ClientesPage,
});

type Cliente = {
  id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  plano: string | null;
  plano_id: string | null;
  data_contrato: string | null;
  planos?: { nome: string; preco: number } | null;
  status: "ativo" | "inativo" | "suspenso";
  observacoes: string | null;
  ip: string | null;
};

type PlanoOpt = { id: string; nome: string; preco: number };

const empty: Partial<Cliente> = { status: "ativo" };
const PAGE_SIZE = 20;

function ClientesPage() {
  const [items, setItems] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [planos, setPlanos] = useState<PlanoOpt[]>([]);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>(empty);
  const [uptimeMap, setUptimeMap] = useState<Map<string, number>>(new Map());
  const [mwHours, setMwHours] = useState<number>(1);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(0); }, [searchDebounced]);

  const load = async () => {
    let q = supabase
      .from("clientes")
      .select("*, planos(nome, preco)", { count: "exact" })
      .order("created_at", { ascending: false });
    const s = searchDebounced.trim().replace(/[%,]/g, "");
    if (s) {
      q = q.or(`nome.ilike.%${s}%,documento.ilike.%${s}%,email.ilike.%${s}%`);
    }
    const from = page * PAGE_SIZE;
    q = q.range(from, from + PAGE_SIZE - 1);
    const { data, error, count } = await q;
    if (error) toast.error(error.message);
    setItems((data as unknown as Cliente[]) ?? []);
    setTotal(count ?? 0);
    const { data: pl } = await supabase.from("planos").select("id, nome, preco").eq("ativo", true).order("nome");
    setPlanos((pl as PlanoOpt[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, searchDebounced]);

  useEffect(() => {
    let active = true;
    (async () => {
      const mw = monthWindow();
      const { data } = await supabase
        .from("chamados")
        .select("cliente_id,created_at,resolvido_at,tipo_problema")
        .or(`resolvido_at.is.null,resolvido_at.gte.${mw.start.toISOString()}`);
      if (!active) return;
      const raw = (data ?? []) as (ChamadoUptime & { tipo_problema: string | null })[];
      const filtered = raw.filter((c) => !isNonDowntimeTipo(c.tipo_problema));
      const map = downtimeByCliente(filtered, mw.start, mw.end);
      setUptimeMap(map);
      setMwHours(mw.hours);
    })();
    return () => { active = false; };
  }, []);

  const uptimeFor = (id: string): number => uptimePct(uptimeMap.get(id) ?? 0, mwHours, 1);
  const uptimeColor = (pct: number) =>
    pct >= 99.5 ? "text-emerald-400" : pct >= 98 ? "text-amber-400" : "text-red-400";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome) return toast.error("Nome é obrigatório");
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    delete payload.planos;
    const { error } = form.id
      ? await supabase.from("clientes").update(payload as never).eq("id", form.id)
      : await supabase.from("clientes").insert(payload as never);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Cliente atualizado" : "Cliente cadastrado");
    setOpen(false);
    setForm(empty);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente removido");
    load();
  };

  const filtered = items;

  const statusBadge = (s: string) => ({
    ativo: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    inativo: "border-white/10 bg-white/5 text-muted-foreground",
    suspenso: "border-red-500/30 bg-red-500/10 text-red-400",
  })[s] ?? "";

  return (
    <AppShell title="Clientes">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2 border border-border bg-card px-3 py-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, documento, email…"
            className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
          />
        </div>
        <button
          onClick={() => {
            setForm(empty);
            setOpen(true);
          }}
          className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo Cliente
        </button>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
            <tr>
              <th className="p-4 font-medium font-mono">NOME</th>
              <th className="p-4 font-medium font-mono">DOCUMENTO</th>
              <th className="p-4 font-medium font-mono">CONTATO</th>
              <th className="p-4 font-medium font-mono">PLANO</th>
              <th className="p-4 font-medium font-mono">CONTRATO</th>
              <th className="p-4 font-medium font-mono">UPTIME (MÊS)</th>
              <th className="p-4 font-medium font-mono">STATUS</th>
              <th className="p-4 font-medium font-mono text-right">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground font-mono">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/30">
                <td className="p-4 font-medium">
                  <Link to="/clientes/$id" params={{ id: c.id }} className="hover:text-primary hover:underline">
                    {c.nome}
                  </Link>
                </td>
                <td className="p-4 font-mono text-muted-foreground">{c.documento ?? "—"}</td>
                <td className="p-4">
                  <div>{c.email ?? "—"}</div>
                  <div className="text-muted-foreground font-mono">{c.telefone ?? ""}</div>
                </td>
                <td className="p-4 font-mono">
                  {c.planos?.nome ?? c.plano ?? "—"}
                  {c.planos && <div className="text-[10px] text-muted-foreground">R$ {Number(c.planos.preco).toFixed(2)}</div>}
                </td>
                <td className="p-4 font-mono text-muted-foreground">{c.data_contrato ?? "—"}</td>
                <td className="p-4 font-mono">
                  {(() => {
                    const pct = uptimeFor(c.id);
                    return <span className={uptimeColor(pct)}>{fmtUptime(pct)}</span>;
                  })()}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 border font-mono uppercase ${statusBadge(c.status)}`}>{c.status}</span>
                </td>
                <td className="p-4 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => {
                        setForm(c);
                        setOpen(true);
                      }}
                      className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-xs font-mono text-muted-foreground">
        <div>
          {total > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total}` : "0 resultados"}
        </div>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1 border border-border bg-card disabled:opacity-30 hover:bg-secondary inline-flex items-center gap-1">
            <ChevronLeft className="h-3 w-3" /> Anterior
          </button>
          <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border border-border bg-card disabled:opacity-30 hover:bg-secondary inline-flex items-center gap-1">
            Próxima <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={save}
            className="bg-card border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="font-display text-lg font-bold">
                {form.id ? "Editar Cliente" : "Novo Cliente"}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome *" value={form.nome ?? ""} onChange={(v) => setForm({ ...form, nome: v })} required />
              <Field label="Documento (CPF/CNPJ)" value={form.documento ?? ""} onChange={(v) => setForm({ ...form, documento: v })} />
              <Field label="Email" type="email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Telefone" value={form.telefone ?? ""} onChange={(v) => setForm({ ...form, telefone: v })} />
              <Field label="Endereço" value={form.endereco ?? ""} onChange={(v) => setForm({ ...form, endereco: v })} />
              <Field label="Cidade" value={form.cidade ?? ""} onChange={(v) => setForm({ ...form, cidade: v })} />
              <Field label="IP do cliente" value={form.ip ?? ""} onChange={(v) => setForm({ ...form, ip: v })} />
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Plano</label>
                <select
                  value={form.plano_id ?? ""}
                  onChange={(e) => setForm({ ...form, plano_id: e.target.value || null })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                >
                  <option value="">— Sem plano —</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome} — R$ {Number(p.preco).toFixed(2)}</option>
                  ))}
                </select>
              </div>
              <Field label="Data do contrato" type="date" value={form.data_contrato ?? ""} onChange={(v) => setForm({ ...form, data_contrato: v || null })} />
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Status</label>
                <select
                  value={form.status ?? "ativo"}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Cliente["status"] })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="suspenso">Suspenso</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Observações</label>
                <textarea
                  value={form.observacoes ?? ""}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground">
                Cancelar
              </button>
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:opacity-90">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
      />
    </div>
  );
}