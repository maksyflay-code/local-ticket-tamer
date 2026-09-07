import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/guard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from "recharts";
import { Activity, AlertTriangle, CheckCircle2, Users, Ticket, Wifi, TrendingUp, Printer, Timer, Zap, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { downtimeByCliente, totalDowntime, uptimePct, fmtUptime, fmtDowntime, isNonDowntimeTipo, type ChamadoUptime } from "@/lib/uptime";

export const Route = createFileRoute("/estatisticas")({
  beforeLoad: requireAuth,
  component: EstatisticasPage,
});

type Period = "7d" | "30d" | "90d" | "mtd" | "custom";
const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  mtd: "Este mês",
  custom: "Personalizado",
};
const PRESET_PERIODS: Period[] = ["7d", "30d", "90d", "mtd"];
// Filtros de período: 7d, 30d, 90d, Este mês (mtd) e Personalizado (custom) com datas visíveis.
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function periodStart(p: Period, customFrom?: string): Date {
  if (p === "custom" && customFrom) {
    const d = new Date(customFrom + "T00:00:00");
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (p === "mtd") {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1, 0, 0, 0, 0);
  }
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  d.setDate(d.getDate() - (days - 1));
  return d;
}
function periodEnd(p: Period, customTo?: string): Date {
  if (p === "custom" && customTo) {
    const d = new Date(customTo + "T23:59:59");
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

type ChamadoRow = {
  id: string;
  status: string;
  prioridade: string;
  categoria: string | null;
  tipo_problema: string | null;
  cliente_id: string | null;
  created_at: string;
  resolvido_at: string | null;
  iniciado_at: string | null;
  finalizado_at: string | null;
  clientes: { nome: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  aberto: "#f59e0b",
  em_andamento: "#3b82f6",
  aguardando_cliente: "#94a3b8",
  resolvido: "#10b981",
  fechado: "#64748b",
};
const PRIO_COLORS: Record<string, string> = {
  urgente: "#ef4444",
  alta: "#f97316",
  media: "#eab308",
  baixa: "#64748b",
};
const CHART_PALETTE = ["#4f46e5", "#6366f1", "#818cf8", "#a78bfa", "#c4b5fd", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

function fmtDayLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function EstatisticasPage() {
  const [period, setPeriod] = useState<Period>("mtd");
  const [customFrom, setCustomFrom] = useState<string>(firstOfMonthStr());
  const [customTo, setCustomTo] = useState<string>(todayStr());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ChamadoRow[]>([]);
  const [prevRows, setPrevRows] = useState<ChamadoRow[]>([]);
  const [prevRange, setPrevRange] = useState<{ start: Date; end: Date } | null>(null);
  const [clientesAtivos, setClientesAtivos] = useState(0);
  const [novosClientes, setNovosClientes] = useState(0);
  // Janela validada (só atualiza após debounce + validação) — evita travar a UI com datas parciais
  const [range, setRange] = useState<{ start: Date; end: Date }>(() => ({
    start: periodStart("mtd"),
    end: periodEnd("mtd"),
  }));

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const start = periodStart(period, customFrom);
        const end = periodEnd(period, customTo);
        // Ignora datas inválidas / anos incompletos digitados (ex: 01/06/2)
        if (period === "custom") {
          const y1 = Number((customFrom || "").slice(0, 4));
          const y2 = Number((customTo || "").slice(0, 4));
          if (!y1 || !y2 || y1 < 2000 || y2 < 2000 || start > end) {
            if (active) setLoading(false);
            return;
          }
        }
        const spanMs = end.getTime() - start.getTime();
        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - spanMs);
        const [chamadosRes, clientesRes, novosRes, prevChamadosRes] = await Promise.all([
          supabase
            .from("chamados")
            .select("id,status,prioridade,categoria,tipo_problema,cliente_id,created_at,resolvido_at,iniciado_at,finalizado_at,clientes(nome)")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString())
            .order("created_at", { ascending: false })
            .limit(1000),
          supabase.from("clientes").select("id", { count: "exact", head: true }).eq("status", "ativo"),
          supabase.from("clientes").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()),
          supabase
            .from("chamados")
            .select("id,status,prioridade,categoria,tipo_problema,cliente_id,created_at,resolvido_at,iniciado_at,finalizado_at,clientes(nome)")
            .gte("created_at", prevStart.toISOString())
            .lte("created_at", prevEnd.toISOString())
            .order("created_at", { ascending: false })
            .limit(1000),
        ]);
        if (!active) return;
        setRange({ start, end });
        setPrevRange({ start: prevStart, end: prevEnd });
        setRows((chamadosRes.data ?? []) as ChamadoRow[]);
        setPrevRows((prevChamadosRes.data ?? []) as ChamadoRow[]);
        setClientesAtivos(clientesRes.count ?? 0);
        setNovosClientes(novosRes.count ?? 0);
      } finally {
        if (active) setLoading(false);
      }
    };
    // Debounce enquanto o usuário digita a data
    const delay = period === "custom" ? 450 : 0;
    const t = setTimeout(run, delay);
    return () => { active = false; clearTimeout(t); };
  }, [period, customFrom, customTo]);

  const stats = useMemo(() => {
    const abertos = rows.filter((r) => r.status === "aberto" || r.status === "em_andamento").length;
    const resolvidos = rows.filter((r) => r.status === "resolvido" || r.status === "fechado").length;
    let tempoTotal = 0; let count = 0;
    for (const r of rows) {
      if (r.resolvido_at) {
        const h = (new Date(r.resolvido_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
        if (h >= 0) { tempoTotal += h; count++; }
      }
    }
    const tempoMedio = count > 0 ? tempoTotal / count : 0;
    return { abertos, resolvidos, total: rows.length, tempoMedio };
  }, [rows]);

  // MTTR/TTFR agregado do período
  const mttrTtfr = useMemo(() => computeMttrTtfr(rows), [rows]);
  const prevMttrTtfr = useMemo(() => computeMttrTtfr(prevRows), [prevRows]);
  const prevStats = useMemo(() => {
    let tempoTotal = 0; let count = 0;
    for (const r of prevRows) {
      if (r.resolvido_at) {
        const h = (new Date(r.resolvido_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
        if (h >= 0) { tempoTotal += h; count++; }
      }
    }
    return { total: prevRows.length, tempoMedio: count > 0 ? tempoTotal / count : 0 };
  }, [prevRows]);

  const prevUptimeGeral = useMemo(() => {
    if (!prevRange) return null;
    const { start, end } = prevRange;
    const hours = Math.max(1 / 60, (end.getTime() - start.getTime()) / 3_600_000);
    const chamadosUp: ChamadoUptime[] = prevRows
      .filter((r) => r.cliente_id && !isNonDowntimeTipo(r.tipo_problema))
      .map((r) => ({
        cliente_id: r.cliente_id,
        created_at: r.created_at,
        resolvido_at: r.resolvido_at,
        iniciado_at: r.iniciado_at,
        finalizado_at: r.finalizado_at,
      }));
    const dt = totalDowntime(chamadosUp, start, end);
    return uptimePct(dt, hours, Math.max(1, clientesAtivos));
  }, [prevRows, prevRange, clientesAtivos]);

  const mttrTtfrPorCliente = useMemo(() => {
    type Agg = { nome: string; mttrH: number; ttfrH: number; mttrN: number; ttfrN: number };
    const map = new Map<string, Agg>();
    for (const r of rows) {
      if (!r.cliente_id) continue;
      const nome = r.clientes?.nome ?? "—";
      const a = map.get(r.cliente_id) ?? { nome, mttrH: 0, ttfrH: 0, mttrN: 0, ttfrN: 0 };
      const created = new Date(r.created_at).getTime();
      const fim = r.finalizado_at ? new Date(r.finalizado_at).getTime()
        : r.resolvido_at ? new Date(r.resolvido_at).getTime() : null;
      if (fim != null) {
        const h = (fim - created) / 3_600_000;
        if (h >= 0) { a.mttrH += h; a.mttrN += 1; }
      }
      if (r.iniciado_at) {
        const h = (new Date(r.iniciado_at).getTime() - created) / 3_600_000;
        if (h >= 0) { a.ttfrH += h; a.ttfrN += 1; }
      }
      map.set(r.cliente_id, a);
    }
    return Array.from(map.values())
      .filter((a) => a.mttrN > 0 || a.ttfrN > 0)
      .map((a) => ({
        nome: a.nome,
        mttr: a.mttrN > 0 ? a.mttrH / a.mttrN : null,
        ttfr: a.ttfrN > 0 ? a.ttfrH / a.ttfrN : null,
      }))
      .sort((a, b) => (b.mttr ?? 0) - (a.mttr ?? 0))
      .slice(0, 10);
  }, [rows]);

  const porStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.status, (map.get(r.status) ?? 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const porPrioridade = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.prioridade, (map.get(r.prioridade) ?? 0) + 1);
    const order = ["urgente", "alta", "media", "baixa"];
    return order.filter((k) => map.has(k)).map((k) => ({ name: k, value: map.get(k) ?? 0 }));
  }, [rows]);

  const porTipoProblema = useMemo(() => {
    type Agg = { total: number; resolvidos: number; tempoTotalH: number };
    const map = new Map<string, Agg>();
    for (const r of rows) {
      const raw = (r.tipo_problema ?? "").trim().toUpperCase();
      if (!raw) continue;
      const key = raw;
      const agg = map.get(key) ?? { total: 0, resolvidos: 0, tempoTotalH: 0 };
      agg.total += 1;
      if (r.resolvido_at) {
        const h = (new Date(r.resolvido_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
        if (h >= 0) { agg.resolvidos += 1; agg.tempoTotalH += h; }
      }
      map.set(key, agg);
    }
    let totalAll = 0;
    for (const a of map.values()) totalAll += a.total;
    totalAll = totalAll || 1;
    return Array.from(map.entries())
      .map(([name, a]) => ({
        name: labelTipo(name),
        key: name,
        total: a.total,
        pct: (a.total / totalAll) * 100,
        tempoMedio: a.resolvidos > 0 ? a.tempoTotalH / a.resolvidos : 0,
        resolvidos: a.resolvidos,
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const evolucao = useMemo(() => {
    const { start, end } = range;
    // Cap de segurança: nunca gerar mais de 2 anos de pontos no gráfico
    const days = Math.min(731, Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1));
    const buckets: Array<{ date: string; abertos: number; resolvidos: number }> = [];
    const idx = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      idx.set(key, buckets.length);
      buckets.push({ date: fmtDayLabel(d), abertos: 0, resolvidos: 0 });
    }
    for (const r of rows) {
      const k = r.created_at.slice(0, 10);
      const i = idx.get(k);
      if (i != null) buckets[i].abertos += 1;
      if (r.resolvido_at) {
        const k2 = r.resolvido_at.slice(0, 10);
        const j = idx.get(k2);
        if (j != null) buckets[j].resolvidos += 1;
      }
    }
    return buckets;
  }, [rows, range]);

  const topClientes = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const nome = r.clientes?.nome ?? "Sem cliente";
      map.set(nome, (map.get(nome) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [rows]);

  const uptimePorCliente = useMemo(() => {
    const { start, end } = range;
    const hours = Math.max(1 / 60, (end.getTime() - start.getTime()) / 3_600_000);
    const chamadosUp: ChamadoUptime[] = rows
      .filter((r) => r.cliente_id && !isNonDowntimeTipo(r.tipo_problema))
      .map((r) => ({
        cliente_id: r.cliente_id,
        created_at: r.created_at,
        resolvido_at: r.resolvido_at,
        iniciado_at: r.iniciado_at,
        finalizado_at: r.finalizado_at,
      }));
    const nomeById = new Map<string, string>();
    for (const r of rows) if (r.cliente_id) nomeById.set(r.cliente_id, r.clientes?.nome ?? "—");
    const dt = downtimeByCliente(chamadosUp, start, end);
    return Array.from(dt.entries())
      .map(([id, h]) => ({
        name: nomeById.get(id) ?? "—",
        uptime: uptimePct(h, hours, 1),
        downtimeH: h,
      }))
      .sort((a, b) => a.uptime - b.uptime)
      .slice(0, 10);
  }, [rows, range]);

  const topDowntime = useMemo(() => {
    return [...uptimePorCliente]
      .sort((a, b) => b.downtimeH - a.downtimeH)
      .slice(0, 5);
  }, [uptimePorCliente]);

  const uptimeGeral = useMemo(() => {
    const { start, end } = range;
    const hours = Math.max(1 / 60, (end.getTime() - start.getTime()) / 3_600_000);
    const chamadosUp: ChamadoUptime[] = rows
      .filter((r) => r.cliente_id && !isNonDowntimeTipo(r.tipo_problema))
      .map((r) => ({
        cliente_id: r.cliente_id,
        created_at: r.created_at,
        resolvido_at: r.resolvido_at,
        iniciado_at: r.iniciado_at,
        finalizado_at: r.finalizado_at,
      }));
    const dt = totalDowntime(chamadosUp, start, end);
    return uptimePct(dt, hours, Math.max(1, clientesAtivos));
  }, [rows, clientesAtivos, range]);

  return (
    <AppShell title="Estatísticas">
      <div className="space-y-6 print-area">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Painel analítico</h2>
            <p className="text-sm text-muted-foreground">Visão geral de chamados, clientes e disponibilidade.</p>
            <p className="hidden print:block text-xs text-muted-foreground mt-1">
              Período: {PERIOD_LABEL[period]} — Gerado em {new Date().toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 no-print">
            <div className="flex flex-wrap items-center gap-1 bg-card/60 border border-border/60 rounded-lg p-1">
              {PRESET_PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                    period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
              <button
                onClick={() => setPeriod("custom")}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                  period === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Personalizado
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 bg-card/60 border border-border/60 rounded-lg p-1.5">
              <span className="px-1 text-[11px] font-mono uppercase text-muted-foreground">De</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setPeriod("custom");
                }}
                className="bg-transparent px-2 py-1 text-xs font-mono text-foreground focus:outline-none"
              />
              <span className="px-1 text-[11px] font-mono uppercase text-muted-foreground">Até</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                max={todayStr()}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setPeriod("custom");
                }}
                className="bg-transparent px-2 py-1 text-xs font-mono text-foreground focus:outline-none"
              />
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              title="Imprimir ou salvar como PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={Ticket} label="Total chamados" value={stats.total} loading={loading} tone="primary" />
          <Kpi icon={AlertTriangle} label="Em aberto" value={stats.abertos} loading={loading} tone="amber" />
          <Kpi icon={CheckCircle2} label="Resolvidos" value={stats.resolvidos} loading={loading} tone="emerald" />
          <Kpi icon={Users} label="Clientes ativos" value={clientesAtivos} loading={loading} tone="cyan" subtitle={`+${novosClientes} no período`} />
          <Kpi icon={Wifi} label="Uptime do mês" value={fmtUptime(uptimeGeral)} loading={loading} tone="emerald" />
          <Kpi
            icon={Ticket}
            label="Vs período anterior"
            value={fmtDelta(stats.total, prevStats.total)}
            loading={loading}
            tone="indigo"
            subtitle={`Antes: ${prevStats.total} chamados`}
          />
        </div>

        {/* KPIs — MTTR / TTFR / Uptime com comparativo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCompare
            icon={Timer}
            label="MTTR"
            hint="Tempo médio até resolução"
            value={mttrTtfr.mttr}
            prev={prevMttrTtfr.mttr}
            format={fmtHours}
            lowerIsBetter
            loading={loading}
            tone="indigo"
          />
          <KpiCompare
            icon={Zap}
            label="TTFR"
            hint="Tempo até primeiro atendimento"
            value={mttrTtfr.ttfr}
            prev={prevMttrTtfr.ttfr}
            format={fmtHours}
            lowerIsBetter
            loading={loading}
            tone="amber"
          />
          <KpiCompare
            icon={Wifi}
            label="Uptime"
            hint="Vs período anterior"
            value={uptimeGeral}
            prev={prevUptimeGeral}
            format={fmtUptime}
            lowerIsBetter={false}
            loading={loading}
            tone="emerald"
          />
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Chamados por status" hint={PERIOD_LABEL[period]} className="lg:col-span-1">
            {loading ? <ChartSkeleton /> : porStatus.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={porStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {porStatus.map((e, i) => (
                      <Cell key={i} fill={STATUS_COLORS[e.name] ?? CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(v: number, n: string) => [v, labelStatus(n)]}
                  />
                  <Legend
                    wrapperStyle={{ color: AXIS_COLOR, fontSize: 12 }}
                    formatter={(v) => <span style={{ color: AXIS_COLOR }}>{labelStatus(String(v))}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Chamados por prioridade" hint={PERIOD_LABEL[period]} className="lg:col-span-1">
            {loading ? <ChartSkeleton /> : porPrioridade.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porPrioridade} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="name" stroke={AXIS_COLOR} tick={axisTick} tickFormatter={(v) => labelPrio(v)} />
                  <YAxis stroke={AXIS_COLOR} tick={axisTick} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    cursor={{ fill: "rgba(148,163,184,0.08)" }}
                    formatter={(v: number) => [v, "Chamados"]}
                    labelFormatter={(l) => labelPrio(String(l))}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {porPrioridade.map((e, i) => <Cell key={i} fill={PRIO_COLORS[e.name] ?? CHART_PALETTE[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Tipo de problema" hint="Rompimento, atenuação e outros" className="lg:col-span-1">
            {loading ? <ChartSkeleton /> : porTipoProblema.length === 0 ? <Empty /> : (
              <div className="space-y-3">
                {porTipoProblema.map((t) => {
                  const color = TIPO_COLORS[t.name] ?? "#6366f1";
                  return (
                    <div key={t.key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
                          <span className="font-medium truncate">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                          <span className="text-foreground">{t.total}</span>
                          <span className="text-muted-foreground text-xs">({t.pct.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(2, t.pct)}%`, background: color }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                        <span>{t.resolvidos} resolvidos</span>
                        <span>
                          {t.resolvidos > 0
                            ? `Tempo médio ${t.tempoMedio < 1 ? `${Math.round(t.tempoMedio * 60)}min` : `${t.tempoMedio.toFixed(1)}h`}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ChartCard>

          <ChartCard title="Evolução diária" hint="Abertos vs resolvidos" className="lg:col-span-2">
            {loading ? <ChartSkeleton h={300} /> : evolucao.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={evolucao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gAbertos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gResolvidos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="date" stroke={AXIS_COLOR} tick={axisTick} />
                  <YAxis stroke={AXIS_COLOR} tick={axisTick} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                    cursor={{ stroke: "#475569", strokeDasharray: "3 3" }}
                  />
                  <Legend
                    wrapperStyle={{ color: AXIS_COLOR, fontSize: 12 }}
                    formatter={(v) => <span style={{ color: AXIS_COLOR, textTransform: "capitalize" }}>{v}</span>}
                  />
                  <Area type="monotone" dataKey="abertos" stroke="#f59e0b" strokeWidth={2} fill="url(#gAbertos)" />
                  <Area type="monotone" dataKey="resolvidos" stroke="#10b981" strokeWidth={2} fill="url(#gResolvidos)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top clientes" hint="Por nº de chamados" className="lg:col-span-1">
            {loading ? <ChartSkeleton h={300} /> : topClientes.length === 0 ? <Empty /> : (
              <div className="space-y-2">
                {(() => {
                  const max = Math.max(...topClientes.map((c) => c.value), 1);
                  return topClientes.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 text-sm">
                      <div className="w-40 shrink-0 truncate font-medium" title={c.name}>{c.name}</div>
                      <div className="flex-1 h-3 rounded-full bg-secondary/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-400"
                          style={{ width: `${(c.value / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-8 text-right font-mono tabular-nums text-foreground">{c.value}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Uptime por cliente"
            hint="Mês atual — 10 mais afetados"
            className="lg:col-span-3"
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          >
            {loading ? <ChartSkeleton h={280} /> : uptimePorCliente.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Sem indisponibilidades registradas neste mês — todos os clientes em 100% de uptime.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-mono uppercase text-muted-foreground border-b border-border/60">
                      <th className="py-2 px-3">Cliente</th>
                      <th className="py-2 px-3">Uptime</th>
                      <th className="py-2 px-3 w-1/2">Disponibilidade</th>
                      <th className="py-2 px-3 text-right">Downtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uptimePorCliente.map((c) => {
                      const pct = c.uptime;
                      const tone = pct >= 99 ? "bg-emerald-500" : pct >= 95 ? "bg-amber-500" : "bg-red-500";
                      return (
                        <tr key={c.name} className="border-b border-border/30 last:border-0">
                          <td className="py-2 px-3 font-medium">{c.name}</td>
                          <td className="py-2 px-3 font-mono tabular-nums">{fmtUptime(pct)}</td>
                          <td className="py-2 px-3">
                            <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                              <div className={`h-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground font-mono">{fmtDowntime(c.downtimeH)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Top 5 clientes com mais downtime"
            hint="Horas indisponíveis na janela"
            className="lg:col-span-1"
            icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          >
            {loading ? <ChartSkeleton h={260} /> : topDowntime.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum downtime registrado no período.
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const max = Math.max(...topDowntime.map((c) => c.downtimeH), 0.001);
                  return topDowntime.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-center font-mono text-xs text-muted-foreground">{i + 1}</span>
                      <div className="w-32 shrink-0 truncate font-medium" title={c.name}>{c.name}</div>
                      <div className="flex-1 h-3 rounded-full bg-secondary/60 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400" style={{ width: `${(c.downtimeH / max) * 100}%` }} />
                      </div>
                      <div className="w-16 text-right font-mono tabular-nums text-foreground">{fmtDowntime(c.downtimeH)}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="MTTR e TTFR por cliente"
            hint="10 clientes com maior MTTR"
            className="lg:col-span-2"
            icon={<Timer className="h-4 w-4 text-indigo-400" />}
          >
            {loading ? <ChartSkeleton h={260} /> : mttrTtfrPorCliente.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-mono uppercase text-muted-foreground border-b border-border/60">
                      <th className="py-2 px-3">Cliente</th>
                      <th className="py-2 px-3 text-right">MTTR</th>
                      <th className="py-2 px-3 text-right">TTFR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mttrTtfrPorCliente.map((c) => (
                      <tr key={c.nome} className="border-b border-border/30 last:border-0">
                        <td className="py-2 px-3 font-medium truncate max-w-[240px]" title={c.nome}>{c.nome}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{c.mttr != null ? fmtHours(c.mttr) : "—"}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">{c.ttfr != null ? fmtHours(c.ttfr) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </AppShell>
  );
}

function computeMttrTtfr(rows: ChamadoRow[]): { mttr: number | null; ttfr: number | null } {
  let mttrH = 0, mttrN = 0, ttfrH = 0, ttfrN = 0;
  for (const r of rows) {
    const created = new Date(r.created_at).getTime();
    const fim = r.finalizado_at ? new Date(r.finalizado_at).getTime()
      : r.resolvido_at ? new Date(r.resolvido_at).getTime() : null;
    if (fim != null) {
      const h = (fim - created) / 3_600_000;
      if (h >= 0) { mttrH += h; mttrN += 1; }
    }
    if (r.iniciado_at) {
      const h = (new Date(r.iniciado_at).getTime() - created) / 3_600_000;
      if (h >= 0) { ttfrH += h; ttfrN += 1; }
    }
  }
  return {
    mttr: mttrN > 0 ? mttrH / mttrN : null,
    ttfr: ttfrN > 0 ? ttfrH / ttfrN : null,
  };
}

function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${h.toFixed(1)}h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h - d * 24);
  return `${d}d ${r}h`;
}

function fmtDelta(curr: number, prev: number): string {
  const diff = curr - prev;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  const pct = prev === 0 ? (curr === 0 ? 0 : 100) : Math.abs(diff / prev) * 100;
  return `${sign}${Math.abs(diff)} (${pct.toFixed(0)}%)`;
}

function KpiCompare({
  icon: Icon, label, hint, value, prev, format, lowerIsBetter, loading, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  value: number | null;
  prev: number | null;
  format: (n: number) => string;
  lowerIsBetter: boolean;
  loading?: boolean;
  tone: "primary" | "emerald" | "amber" | "indigo" | "cyan";
}) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  };
  let delta: { pct: number; up: boolean; flat: boolean; good: boolean } | null = null;
  if (value != null && prev != null && Number.isFinite(value) && Number.isFinite(prev)) {
    const diff = value - prev;
    const flat = Math.abs(diff) < 1e-6 || (prev === 0 && value === 0);
    const pct = prev === 0 ? (value === 0 ? 0 : 100) : Math.abs(diff / prev) * 100;
    const up = diff > 0;
    const good = flat ? true : lowerIsBetter ? !up : up;
    delta = { pct, up, flat, good };
  }
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{label}</span>
        <span className={`h-7 w-7 rounded-md border flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <div className="flex items-baseline gap-2">
          <div className="font-display text-2xl font-bold tabular-nums">
            {value != null ? format(value) : "—"}
          </div>
          {delta && (
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono ${
                delta.flat
                  ? "text-muted-foreground bg-secondary/60"
                  : delta.good
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-red-400 bg-red-500/10"
              }`}
              title={prev != null ? `Antes: ${format(prev)}` : ""}
            >
              {delta.flat ? <Minus className="h-3 w-3" /> : delta.up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {delta.pct.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}{prev != null && value != null ? ` — antes ${format(prev)}` : ""}</div>}
    </div>
  );
}

const AXIS_COLOR = "#94a3b8"; // slate-400 — legível no fundo escuro
const GRID_COLOR = "#1e293b"; // slate-800
const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};
const tooltipItemStyle = { color: "#e2e8f0" };
const tooltipLabelStyle = { color: "#cbd5e1", fontWeight: 600 };
const axisTick = { fill: AXIS_COLOR, fontSize: 11 };

function labelStatus(s: string) {
  const m: Record<string, string> = {
    aberto: "Aberto", em_andamento: "Em andamento", aguardando_cliente: "Aguardando cliente",
    resolvido: "Resolvido", fechado: "Fechado",
  };
  return m[s] ?? s;
}
function labelPrio(s: string) {
  const m: Record<string, string> = { urgente: "Urgente", alta: "Alta", media: "Média", baixa: "Baixa" };
  return m[s] ?? s;
}
function labelTipo(s: string) {
  const m: Record<string, string> = {
    ROMPIMENTO: "Rompimento",
    ATENUACAO: "Atenuação",
    OUTROS: "Outros",
    "NÃO INFORMADO": "Não informado",
  };
  return m[s] ?? s.charAt(0) + s.slice(1).toLowerCase();
}
const TIPO_COLORS: Record<string, string> = {
  Rompimento: "#ef4444",
  Atenuação: "#f59e0b",
  Outros: "#6366f1",
  "Não informado": "#64748b",
};

function Kpi({ icon: Icon, label, value, loading, tone, subtitle }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  loading?: boolean;
  tone: "primary" | "emerald" | "amber" | "indigo" | "cyan";
  subtitle?: string;
}) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  };
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{label}</span>
        <span className={`h-7 w-7 rounded-md border flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      {loading ? <Skeleton className="h-7 w-20" /> : (
        <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
      )}
      {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
    </div>
  );
}

function ChartCard({ title, hint, children, className, icon }: {
  title: string; hint?: string; children: React.ReactNode; className?: string; icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display text-sm font-bold tracking-tight">{title}</h3>
        </div>
        {hint && <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton({ h = 260 }: { h?: number }) {
  return <Skeleton className="w-full" style={{ height: h }} />;
}
function Empty() {
  return <div className="py-10 text-center text-sm text-muted-foreground">Sem dados no período selecionado.</div>;
}