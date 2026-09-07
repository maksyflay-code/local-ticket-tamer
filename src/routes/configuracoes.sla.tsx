import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/guard";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { invalidateSlaCache, type Prioridade } from "@/lib/sla";
import { Clock, Save, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/configuracoes/sla")({
  beforeLoad: requireAuth,
  component: SlaConfigPage,
});

type Row = {
  prioridade: Prioridade;
  horas_resolucao: number;
  horas_resposta: number | null;
  updated_at?: string;
};

const ORDER: Prioridade[] = ["urgente", "alta", "media", "baixa"];
const LABEL: Record<Prioridade, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
const TONE: Record<Prioridade, string> = {
  urgente: "text-red-400 border-red-500/30 bg-red-500/5",
  alta: "text-orange-400 border-orange-500/30 bg-orange-500/5",
  media: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
  baixa: "text-muted-foreground border-border bg-background",
};

function SlaConfigPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data, error } = await supabase
        .from("sla_config")
        .select("prioridade, horas_resolucao, horas_resposta, updated_at");
      if (error) toast.error(error.message);
      const map = new Map<string, Row>();
      (data as Row[] | null)?.forEach((r) => map.set(r.prioridade, r));
      setRows(ORDER.map((p) => map.get(p) ?? { prioridade: p, horas_resolucao: 24, horas_resposta: 4 }));
      setLoading(false);
    })();
  }, [isAdmin]);

  const update = (p: Prioridade, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.prioridade === p ? { ...r, ...patch } : r)));
  };

  const save = async (r: Row) => {
    if (!r.horas_resolucao || r.horas_resolucao < 1) return toast.error("Prazo de resolução deve ser maior que 0.");
    if (r.horas_resposta !== null && r.horas_resposta !== undefined && r.horas_resposta < 1) {
      return toast.error("Prazo de resposta deve ser maior que 0 ou vazio.");
    }
    setSavingKey(r.prioridade);
    const { error } = await supabase
      .from("sla_config")
      .update({
        horas_resolucao: r.horas_resolucao,
        horas_resposta: r.horas_resposta ?? null,
      } as never)
      .eq("prioridade", r.prioridade);
    setSavingKey(null);
    if (error) return toast.error(error.message);
    invalidateSlaCache();
    toast.success(`SLA "${LABEL[r.prioridade]}" atualizado`);
  };

  if (!isAdmin) {
    return (
      <AppShell title="Configuração de SLA">
        <div className="border border-border bg-card p-8 text-center font-mono text-sm">
          <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-3" />
          Apenas administradores podem alterar os SLAs.
          <div className="mt-4">
            <button onClick={() => navigate({ to: "/dashboard" })}
              className="px-3 py-2 border border-border bg-card text-xs hover:bg-secondary">
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Configuração de SLA">
      <div className="max-w-3xl">
        <div className="mb-6 flex items-start gap-3 border border-border bg-card p-4">
          <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground font-mono leading-relaxed">
            Defina, por prioridade, o prazo (em horas) entre a abertura do chamado e a resolução.
            Opcionalmente defina também o prazo para a primeira resposta. Os valores afetam imediatamente
            os indicadores de SLA na lista, no detalhe do chamado e no dashboard.
          </div>
        </div>

        {loading ? (
          <div className="border border-border bg-card p-8 text-center text-xs font-mono text-muted-foreground">Carregando…</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.prioridade} className={`border ${TONE[r.prioridade]} p-4 grid grid-cols-1 md:grid-cols-[1fr_140px_140px_auto] gap-3 items-end`}>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Prioridade</div>
                  <div className="font-mono text-sm font-bold uppercase mt-0.5">● {LABEL[r.prioridade]}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-1">
                    {LABEL[r.prioridade]}: até <span className="text-foreground">{r.horas_resolucao}h</span> após abertura
                    {r.horas_resposta ? <> · resposta em <span className="text-foreground">{r.horas_resposta}h</span></> : null}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Resolução (h)</label>
                  <input
                    type="number"
                    min={1}
                    value={r.horas_resolucao}
                    onChange={(e) => update(r.prioridade, { horas_resolucao: Number(e.target.value) || 0 })}
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">1ª resposta (h)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="—"
                    value={r.horas_resposta ?? ""}
                    onChange={(e) => update(r.prioridade, { horas_resposta: e.target.value === "" ? null : Number(e.target.value) })}
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={() => save(r)}
                  disabled={savingKey === r.prioridade}
                  className="bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingKey === r.prioridade ? "Salvando…" : "Salvar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
