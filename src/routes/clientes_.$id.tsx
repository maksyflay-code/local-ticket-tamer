import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/guard";
import { ArrowLeft, Mail, Phone, MapPin, FileText, Plus, Ticket, Clock, CheckCircle2, AlertTriangle, Activity, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { getSlaMap, calcSla, type SlaMap } from "@/lib/sla";
import { pingHost } from "@/lib/ping.functions";
import { PingResult, type PingResultData } from "@/components/PingResult";

export const Route = createFileRoute("/clientes_/$id")({
  beforeLoad: requireAuth,
  component: ClienteDetailPage,
});

type Cliente = {
  id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  status: "ativo" | "inativo" | "suspenso";
  observacoes: string | null;
  data_contrato: string | null;
  plano: string | null;
  planos: { nome: string; preco: number } | null;
  ip: string | null;
};
type ChamadoRow = {
  id: string;
  numero: number;
  codigo: string | null;
  titulo: string;
  status: "aberto" | "aguardando_cliente" | "resolvido" | "fechado";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  created_at: string;
  resolvido_at: string | null;
  tecnico_responsavel: string | null;
};

const statusBadge = (s: string) => ({
  aberto: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  aguardando_cliente: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  resolvido: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  fechado: "border-white/10 bg-white/5 text-muted-foreground",
}[s] ?? "");
const prioColor = (p: string) => ({
  urgente: "text-red-400", alta: "text-orange-400", media: "text-yellow-400", baixa: "text-muted-foreground",
}[p] ?? "");
const clienteStatusBadge = (s: string) => ({
  ativo: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  inativo: "border-white/10 bg-white/5 text-muted-foreground",
  suspenso: "border-red-500/30 bg-red-500/10 text-red-400",
}[s] ?? "");

function ClienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [chamados, setChamados] = useState<ChamadoRow[]>([]);
  const [slaMap, setSlaMap] = useState<SlaMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [netOpen, setNetOpen] = useState(false);
  const [netLoading, setNetLoading] = useState(false);
  const [netResult, setNetResult] = useState<PingResultData | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const runPing = useServerFn(pingHost);

  const runNet = async (ip: string) => {
    setNetOpen(true);
    setNetResult(null);
    setNetError(null);
    setNetLoading(true);
    try {
      const res = await runPing({ data: { host: ip, count: 20 } });
      setNetResult(res as PingResultData);
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setNetError(msg);
    } finally {
      setNetLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const [{ data: cli, error: e1 }, { data: ch, error: e2 }, sla] = await Promise.all([
        supabase.from("clientes").select("*, planos(nome, preco)").eq("id", id).maybeSingle(),
        supabase.from("chamados")
          .select("id, numero, codigo, titulo, status, prioridade, created_at, resolvido_at, tecnico_responsavel")
          .eq("cliente_id", id).order("created_at", { ascending: false }),
        getSlaMap(),
      ]);
      if (e1) toast.error(e1.message);
      if (e2) toast.error(e2.message);
      setCliente((cli as Cliente | null) ?? null);
      setChamados((ch as ChamadoRow[] | null) ?? []);
      setSlaMap(sla);
      setLoading(false);
    })();
  }, [id]);

  const metrics = useMemo(() => {
    const total = chamados.length;
    const abertos = chamados.filter((c) => c.status === "aberto" || c.status === "aguardando_cliente").length;
    const resolvidos = chamados.filter((c) => c.resolvido_at);
    const tempoMedioH = resolvidos.length === 0 ? 0 :
      resolvidos.reduce((acc, c) =>
        acc + (new Date(c.resolvido_at!).getTime() - new Date(c.created_at).getTime()) / 3_600_000, 0) / resolvidos.length;
    let slaOk = 0;
    if (slaMap) {
      for (const c of resolvidos) {
        const info = calcSla(c, slaMap);
        if (info.cumprido) slaOk++;
      }
    }
    const slaPct = resolvidos.length ? (slaOk / resolvidos.length) * 100 : 100;
    return { total, abertos, resolvidos: resolvidos.length, tempoMedioH, slaPct };
  }, [chamados, slaMap]);

  if (loading) {
    return <AppShell title="Cliente"><div className="text-xs font-mono text-muted-foreground">Carregando…</div></AppShell>;
  }
  if (!cliente) {
    return (
      <AppShell title="Cliente">
        <div className="border border-border bg-card p-8 text-center font-mono text-sm">
          Cliente não encontrado.
          <div className="mt-4">
            <Link to="/clientes" className="px-3 py-2 border border-border bg-card text-xs hover:bg-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-3 w-3" /> Voltar
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={cliente.nome}>
      <div className="mb-4">
        <button onClick={() => navigate({ to: "/clientes" })}
          className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Clientes
        </button>
      </div>

      {/* Cabeçalho */}
      <div className="border border-border bg-card p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">{cliente.nome}</h1>
            <div className="font-mono text-xs text-muted-foreground mt-1">{cliente.documento ?? "—"}</div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 border font-mono uppercase text-[10px] ${clienteStatusBadge(cliente.status)}`}>{cliente.status}</span>
              {cliente.planos && (
                <span className="px-2 py-0.5 border border-primary/30 bg-primary/10 text-primary font-mono uppercase text-[10px]">
                  Plano: {cliente.planos.nome} · R$ {Number(cliente.planos.preco).toFixed(2)}
                </span>
              )}
              {cliente.data_contrato && (
                <span className="text-[10px] font-mono text-muted-foreground">Contrato desde {new Date(cliente.data_contrato).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
          </div>
          <Link
            to="/chamados"
            onClick={() => { if (typeof window !== "undefined") sessionStorage.setItem("chamados:prefill-cliente", cliente.id); }}
            className="bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:opacity-90 inline-flex items-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" /> Novo chamado
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          {cliente.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /> {cliente.email}</div>}
          {cliente.telefone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /> {cliente.telefone}</div>}
          {(cliente.endereco || cliente.cidade) && (
            <div className="flex items-center gap-2 md:col-span-2"><MapPin className="h-3 w-3 text-muted-foreground" /> {[cliente.endereco, cliente.cidade].filter(Boolean).join(" — ")}</div>
          )}
          {cliente.ip && (
            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                onClick={() => navigator.clipboard?.writeText(cliente.ip!).then(() => toast.success("IP copiado"))}
                className="font-mono text-sm font-semibold text-foreground hover:text-primary"
                title="Copiar IP"
              >
                {cliente.ip}
              </button>
              <button
                onClick={() => runNet(cliente.ip!)}
                className="ml-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 hover:opacity-90"
              >
                <Activity className="h-3.5 w-3.5" /> Ping
              </button>
            </div>
          )}
          {cliente.observacoes && (
            <div className="md:col-span-2 flex items-start gap-2 text-muted-foreground"><FileText className="h-3 w-3 mt-0.5" /> <span className="whitespace-pre-wrap">{cliente.observacoes}</span></div>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Metric icon={Ticket} label="Total de chamados" value={String(metrics.total)} color="text-primary" />
        <Metric icon={AlertTriangle} label="Abertos / em andamento" value={String(metrics.abertos)} color="text-amber-400" />
        <Metric icon={Clock} label="Tempo médio de resolução" value={metrics.resolvidos === 0 ? "—" : `${metrics.tempoMedioH.toFixed(1)}h`} color="text-violet-400" />
        <Metric icon={CheckCircle2} label="SLA cumprido" value={metrics.resolvidos === 0 ? "—" : `${metrics.slaPct.toFixed(0)}%`}
          color={metrics.slaPct >= 90 ? "text-emerald-400" : metrics.slaPct >= 70 ? "text-amber-400" : "text-red-400"} />
      </div>

      {/* Histórico */}
      <div className="border border-border bg-card overflow-x-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Histórico de chamados</h2>
          <span className="text-[10px] font-mono text-muted-foreground">{chamados.length} registro{chamados.length === 1 ? "" : "s"}</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary/30 border-b border-border text-muted-foreground">
            <tr>
              <th className="p-3 font-mono">ID</th>
              <th className="p-3 font-mono">TÍTULO</th>
              <th className="p-3 font-mono">PRIORIDADE</th>
              <th className="p-3 font-mono">ABERTO EM</th>
              <th className="p-3 font-mono">RESOLVIDO EM</th>
              <th className="p-3 font-mono">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {chamados.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground font-mono">Sem chamados.</td></tr>
            )}
            {chamados.map((c) => (
              <tr key={c.id}
                onClick={() => {
                  if (typeof window !== "undefined") sessionStorage.setItem("chamados:open-id", c.id);
                  navigate({ to: "/chamados" });
                }}
                className="hover:bg-secondary/30 cursor-pointer">
                <td className="p-3 font-mono text-muted-foreground">{c.codigo ?? `#TK-${String(c.numero).padStart(4, "0")}`}</td>
                <td className="p-3">{c.titulo}</td>
                <td className={`p-3 font-mono uppercase ${prioColor(c.prioridade)}`}>{c.prioridade}</td>
                <td className="p-3 font-mono text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-3 font-mono text-muted-foreground">{c.resolvido_at ? new Date(c.resolvido_at).toLocaleString("pt-BR") : "—"}</td>
                <td className="p-3"><span className={`px-2 py-0.5 border font-mono uppercase ${statusBadge(c.status)}`}>{c.status.replace("_", " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {netOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4" /> Ping — {cliente.ip}
              </h2>
              <button onClick={() => setNetOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              {netLoading ? (
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Coletando 20 amostras…
                </div>
              ) : netError ? (
                <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-red-400">{netError}</pre>
              ) : netResult ? (
                <PingResult data={netResult} />
              ) : (
                <div className="text-xs font-mono text-muted-foreground">Sem resultado.</div>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                disabled={netLoading}
                onClick={() => cliente.ip && runNet(cliente.ip)}
                className="px-3 py-2 text-xs font-mono border border-border hover:border-primary hover:text-primary disabled:opacity-50"
              >
                Repetir
              </button>
              <button
                onClick={() => setNetOpen(false)}
                className="bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Ticket; label: string; value: string; color: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
