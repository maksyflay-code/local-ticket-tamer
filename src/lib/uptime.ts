// Cálculo de uptime/downtime baseado em chamados.
// Downtime = soma da sobreposição [iniciado_at|created_at, finalizado_at|resolvido_at|now] com a janela.
// Quando o operador ajusta o horário real de início/fim do atendimento
// (iniciado_at / finalizado_at) o cálculo prioriza esses valores em vez do
// created_at/resolvido_at do chamado.
// Uptime global = 1 - (downtimeTotal / (clientesAtivos * janelaHoras)).
// Uptime por cliente = 1 - (downtimeCliente / janelaHoras), limitado a [0,1].

export type ChamadoUptime = {
  cliente_id: string | null;
  created_at: string;
  resolvido_at: string | null;
  iniciado_at?: string | null;
  finalizado_at?: string | null;
};

// Tipos de problema que NÃO contam como downtime (cliente não está off).
// Normaliza removendo acentos, espaços e caixa.
export function isNonDowntimeTipo(tipo: string | null | undefined): boolean {
  const norm = (tipo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return (
    norm === "ATENUACAO" ||
    norm === "VERIFICACAO DE ROTAS" ||
    norm === "VERIFICACAO ROTAS"
  );
}

export function monthWindow(now: Date = new Date()): { start: Date; end: Date; hours: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = now;
  const hours = Math.max(1 / 60, (end.getTime() - start.getTime()) / 3_600_000);
  return { start, end, hours };
}

function overlapHours(c: ChamadoUptime, start: Date, end: Date): number {
  const cs = new Date(c.iniciado_at ?? c.created_at).getTime();
  const ce = c.finalizado_at
    ? new Date(c.finalizado_at).getTime()
    : c.resolvido_at
      ? new Date(c.resolvido_at).getTime()
      : end.getTime();
  if (!Number.isFinite(cs) || !Number.isFinite(ce) || ce <= cs) return 0;
  const s = Math.max(cs, start.getTime());
  const e = Math.min(ce, end.getTime());
  return Math.max(0, (e - s) / 3_600_000);
}

export function downtimeByCliente(
  chamados: ChamadoUptime[],
  start: Date,
  end: Date,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of chamados) {
    if (!c.cliente_id) continue;
    const h = overlapHours(c, start, end);
    if (h <= 0) continue;
    map.set(c.cliente_id, (map.get(c.cliente_id) ?? 0) + h);
  }
  return map;
}

export function totalDowntime(chamados: ChamadoUptime[], start: Date, end: Date): number {
  let total = 0;
  for (const c of chamados) total += overlapHours(c, start, end);
  return total;
}

export function uptimePct(downtimeH: number, windowH: number, clientesAtivos = 1): number {
  const denom = Math.max(1, clientesAtivos) * Math.max(1 / 60, windowH);
  return Math.max(0, Math.min(100, (1 - downtimeH / denom) * 100));
}

export function fmtUptime(pct: number): string {
  if (pct >= 99.99) return "99.99%";
  if (pct >= 99) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

export function fmtDowntime(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${h.toFixed(1)}h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h - d * 24);
  return `${d}d ${r}h`;
}