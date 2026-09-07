import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/guard";
import { Search, Activity, Terminal, Plus, Pencil, Trash2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { pingHost } from "@/lib/ping.functions";
import { PingResult, type PingResultData } from "@/components/PingResult";

export const Route = createFileRoute("/equipamentos")({
  beforeLoad: requireAuth,
  component: EquipamentosPage,
});

type Equipamento = {
  id: string;
  hostname: string;
  ipv4: string;
  tipo: string;
  fabricante: string;
  pop: string | null;
  ativo: boolean;
  observacoes: string | null;
};

const empty: Partial<Equipamento> = { tipo: "Switch L3", fabricante: "DATACOM - DmOS", ativo: true };

function EquipamentosPage() {
  const [items, setItems] = useState<Equipamento[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Equipamento>>(empty);
  const [pingOpen, setPingOpen] = useState(false);
  const [pingHostName, setPingHostName] = useState("");
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<PingResultData | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);
  const runPing = useServerFn(pingHost);

  const load = async () => {
    const { data, error } = await supabase
      .from("equipamentos" as never)
      .select("*")
      .order("hostname", { ascending: true });
    if (error) return toast.error(error.message);
    setItems((data as unknown as Equipamento[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((e) =>
      e.hostname.toLowerCase().includes(s) ||
      e.ipv4.includes(s) ||
      (e.pop ?? "").toLowerCase().includes(s)
    );
  }, [items, search]);

  const copyCmd = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      toast.success(`Comando copiado: ${cmd}`);
    } catch {
      toast.message(cmd, { description: "Copie manualmente." });
    }
  };

  const onPing = async (ip: string) => {
    setPingHostName(ip);
    setPingOpen(true);
    setPingResult(null);
    setPingError(null);
    setPingLoading(true);
    try {
      const res = await runPing({ data: { host: ip, count: 8 } });
      setPingResult(res as PingResultData);
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setPingError(msg);
    } finally {
      setPingLoading(false);
    }
  };

  const downloadBat = (ip: string) => {
    const bat = `@echo off\r\ntitle Ping ${ip}\r\nping -t ${ip}\r\npause\r\n`;
    const blob = new Blob([bat], { type: "application/bat" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ping-${ip}.bat`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onSsh = (ip: string) => {
    copyCmd(`ssh ${ip}`);
    // tenta abrir o cliente SSH padrão do sistema
    try {
      window.location.href = `ssh://${ip}`;
    } catch { /* noop */ }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hostname || !form.ipv4) return toast.error("Hostname e IPv4 obrigatórios");
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    const { error } = form.id
      ? await supabase.from("equipamentos" as never).update(payload as never).eq("id", form.id)
      : await supabase.from("equipamentos" as never).insert(payload as never);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Equipamento atualizado" : "Equipamento cadastrado");
    setOpen(false);
    setForm(empty);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este equipamento?")) return;
    const { error } = await supabase.from("equipamentos" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  };

  return (
    <AppShell title="Equipamentos">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2 border border-border bg-card px-3 py-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por hostname, IP ou POP…"
            className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
          />
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          {filtered.length} / {items.length} equipamentos
        </div>
        <button
          onClick={() => { setForm(empty); setOpen(true); }}
          className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
            <tr>
              <th className="p-3 font-medium font-mono">HOSTNAME</th>
              <th className="p-3 font-medium font-mono">IPv4</th>
              <th className="p-3 font-medium font-mono">TIPO</th>
              <th className="p-3 font-medium font-mono">FABRICANTE</th>
              <th className="p-3 font-medium font-mono">POP</th>
              <th className="p-3 font-medium font-mono">ATIVO</th>
              <th className="p-3 font-medium font-mono text-right">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground font-mono">Nenhum equipamento.</td></tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-secondary/30">
                <td className="p-3 font-medium font-mono">{e.hostname}</td>
                <td className="p-3 font-mono">{e.ipv4}</td>
                <td className="p-3 font-mono text-muted-foreground">{e.tipo}</td>
                <td className="p-3 font-mono text-muted-foreground">{e.fabricante}</td>
                <td className="p-3 font-mono text-muted-foreground">{e.pop ?? "—"}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 border font-mono uppercase ${e.ativo ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-muted-foreground"}`}>
                    {e.ativo ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => onPing(e.ipv4)}
                      title={`ping ${e.ipv4}`}
                      className="px-2 py-1 border border-border hover:border-primary hover:text-primary inline-flex items-center gap-1 font-mono"
                    >
                      <Activity className="h-3.5 w-3.5" /> Ping
                    </button>
                    <button
                      onClick={() => onSsh(e.ipv4)}
                      title={`ssh ${e.ipv4}`}
                      className="px-2 py-1 border border-border hover:border-primary hover:text-primary inline-flex items-center gap-1 font-mono"
                    >
                      <Terminal className="h-3.5 w-3.5" /> SSH
                    </button>
                    <button
                      onClick={() => { setForm(e); setOpen(true); }}
                      className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(e.id)}
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

      <p className="mt-4 text-[11px] font-mono text-muted-foreground">
        O botão <strong>Ping</strong> executa o teste no servidor e mostra o resultado aqui (igual ao painel dos roteadores).
        O botão <strong>SSH</strong> copia o comando e tenta abrir o cliente SSH padrão (via <code>ssh://</code>).
      </p>

      {pingOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4" /> Ping {pingHostName}
              </h2>
              <button onClick={() => setPingOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              {pingLoading ? (
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Executando ping…
                </div>
              ) : pingError ? (
                <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-red-400">{pingError}</pre>
              ) : pingResult ? (
                <PingResult data={pingResult} />
              ) : (
                <div className="text-xs font-mono text-muted-foreground">Sem resultado.</div>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-between gap-2">
              <button
                onClick={() => downloadBat(pingHostName)}
                className="px-3 py-2 text-xs font-mono border border-border hover:border-primary hover:text-primary inline-flex items-center gap-2"
              >
                <Download className="h-3.5 w-3.5" /> Baixar .bat (ping -t local)
              </button>
              <div className="flex gap-2">
                <button
                  disabled={pingLoading}
                  onClick={() => onPing(pingHostName)}
                  className="px-3 py-2 text-xs font-mono border border-border hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  Repetir
                </button>
                <button
                  onClick={() => setPingOpen(false)}
                  className="bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={save} className="bg-card border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="font-display text-lg font-bold">{form.id ? "Editar Equipamento" : "Novo Equipamento"}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <F label="Hostname *" value={form.hostname ?? ""} onChange={(v) => setForm({ ...form, hostname: v })} required />
              <F label="IPv4 *" value={form.ipv4 ?? ""} onChange={(v) => setForm({ ...form, ipv4: v })} required />
              <F label="Tipo" value={form.tipo ?? ""} onChange={(v) => setForm({ ...form, tipo: v })} />
              <F label="Fabricante" value={form.fabricante ?? ""} onChange={(v) => setForm({ ...form, fabricante: v })} />
              <F label="POP" value={form.pop ?? ""} onChange={(v) => setForm({ ...form, pop: v })} />
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Ativo</label>
                <select
                  value={form.ativo ? "1" : "0"}
                  onChange={(e) => setForm({ ...form, ativo: e.target.value === "1" })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                >
                  <option value="1">Sim</option>
                  <option value="0">Não</option>
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
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground">Cancelar</button>
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:opacity-90">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function F({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
      />
    </div>
  );
}