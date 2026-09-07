import { supabase } from "@/integrations/supabase/client";

export type Prioridade = "baixa" | "media" | "alta" | "urgente";

export type SlaRule = {
  prioridade: Prioridade;
  horas_resolucao: number;
  horas_resposta: number | null;
};

export type SlaMap = Record<Prioridade, SlaRule>;

const FALLBACK: SlaMap = {
  urgente: { prioridade: "urgente", horas_resolucao: 4, horas_resposta: 1 },
  alta:    { prioridade: "alta",    horas_resolucao: 8, horas_resposta: 2 },
  media:   { prioridade: "media",   horas_resolucao: 24, horas_resposta: 4 },
  baixa:   { prioridade: "baixa",   horas_resolucao: 72, horas_resposta: 8 },
};

let cache: { map: SlaMap; at: number } | null = null;
let inflight: Promise<SlaMap> | null = null;
const TTL_MS = 60_000;

export async function getSlaMap(force = false): Promise<SlaMap> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.map;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase
      .from("sla_config")
      .select("prioridade, horas_resolucao, horas_resposta");
    const map: SlaMap = { ...FALLBACK };
    if (!error && data) {
      for (const row of data as SlaRule[]) {
        if (row.prioridade in map) map[row.prioridade] = row;
      }
    }
    cache = { map, at: Date.now() };
    inflight = null;
    return map;
  })();
  return inflight;
}

export function invalidateSlaCache() {
  cache = null;
}

export type SlaInfo = {
  ativo: boolean;
  pausado: boolean;
  estourado: boolean;
  limite: number;        // horas
  decorrido: number;     // horas
  restante: number;      // horas (negativo se estourado)
  pct: number;           // 0..100+ (% do prazo consumido)
  color: "emerald" | "amber" | "red" | "slate";
  cumprido: boolean | null; // só faz sentido quando resolvido
};

export function calcSla(
  c: {
    status: string;
    prioridade: string;
    created_at: string;
    resolvido_at: string | null;
    sla_pausado_at?: string | null;
    sla_pausado_total_seg?: number | null;
  },
  map: SlaMap,
): SlaInfo {
  const rule = map[c.prioridade as Prioridade] ?? FALLBACK.media;
  const limite = rule.horas_resolucao;
  const ativo = c.status !== "resolvido" && c.status !== "fechado";
  const pausado = ativo && c.status === "aguardando_cliente";
  const fim = c.resolvido_at ? new Date(c.resolvido_at).getTime() : Date.now();
  const pausadoAcumuladoH = (c.sla_pausado_total_seg ?? 0) / 3600;
  const pausadoAtualH = pausado && c.sla_pausado_at
    ? Math.max(0, (Date.now() - new Date(c.sla_pausado_at).getTime()) / 3_600_000)
    : 0;
  const brutoH = Math.max(0, (fim - new Date(c.created_at).getTime()) / 3_600_000);
  const decorrido = Math.max(0, brutoH - pausadoAcumuladoH - pausadoAtualH);
  const restante = limite - decorrido;
  const pct = Math.min(999, (decorrido / limite) * 100);
  const estourado = ativo && !pausado && decorrido > limite;
  const cumprido = ativo ? null : decorrido <= limite;
  const color: SlaInfo["color"] =
    pausado
      ? "slate"
      : !ativo
      ? cumprido ? "emerald" : "red"
      : pct >= 100 ? "red" : pct >= 75 ? "amber" : "emerald";
  return { ativo, pausado, estourado, limite, decorrido, restante, pct, color, cumprido };
}

export function formatHorasRestantes(h: number): string {
  const abs = Math.abs(h);
  if (abs < 1) return `${Math.round(abs * 60)}m`;
  if (abs < 24) {
    const horas = Math.floor(abs);
    const min = Math.round((abs - horas) * 60);
    return min ? `${horas}h ${min}m` : `${horas}h`;
  }
  const dias = Math.floor(abs / 24);
  const horas = Math.round(abs - dias * 24);
  return horas ? `${dias}d ${horas}h` : `${dias}d`;
}
