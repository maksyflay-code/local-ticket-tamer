import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";

export type PingStats = {
  min: number;
  avg: number;
  max: number;
  jitter: number;
  loss: number;
  sent: number;
  received: number;
};

export type PingResultData = {
  ok: boolean;
  output: string;
  samples: number[];
  stats: PingStats;
  method?: string;
};

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n < 10 ? n.toFixed(1) : Math.round(n).toString();
}

function latencyColor(ms: number) {
  if (ms < 30) return "text-emerald-400";
  if (ms < 80) return "text-amber-400";
  return "text-red-400";
}

export function PingResult({ data }: { data: PingResultData }) {
  const { samples, stats } = data;
  const chartData = samples.map((ms, i) => ({ i: i + 1, ms: Number(ms.toFixed(1)) }));
  const hasSamples = samples.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Mín" value={`${fmt(stats.min)} ms`} color={latencyColor(stats.min)} />
        <Stat label="Média" value={`${fmt(stats.avg)} ms`} color={latencyColor(stats.avg)} />
        <Stat label="Máx" value={`${fmt(stats.max)} ms`} color={latencyColor(stats.max)} />
        <Stat label="Jitter" value={`${fmt(stats.jitter)} ms`} color="text-violet-400" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Pacotes"
          value={`${stats.received}/${stats.sent}`}
          color={stats.received === stats.sent ? "text-emerald-400" : "text-amber-400"}
        />
        <Stat
          label="Perda"
          value={`${stats.loss}%`}
          color={stats.loss === 0 ? "text-emerald-400" : stats.loss < 50 ? "text-amber-400" : "text-red-400"}
        />
      </div>

      {hasSamples && (
        <div className="border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
            Latência por amostra (ms)
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                <XAxis dataKey="i" stroke="#cbd5e1" tick={{ fontSize: 10, fontFamily: "monospace", fill: "#cbd5e1" }} />
                <YAxis stroke="#cbd5e1" tick={{ fontSize: 10, fontFamily: "monospace", fill: "#cbd5e1" }} unit="ms" width={45} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    color: "#e2e8f0",
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                  itemStyle={{ color: "#60a5fa" }}
                  formatter={(v: number) => [`${v} ms`, "Latência"]}
                  labelFormatter={(l) => `Amostra #${l}`}
                />
                <ReferenceLine y={stats.avg} stroke="#60a5fa" strokeDasharray="4 4" opacity={0.6} />
                <Line type="monotone" dataKey="ms" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: "#60a5fa" }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <details className="border border-border bg-background/40">
        <summary className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-mono hover:text-foreground">
          Saída bruta
        </summary>
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed border-t border-border max-h-64 overflow-auto">
          {data.output}
        </pre>
      </details>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}