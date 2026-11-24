import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { estoqueDb as db } from "@/lib/estoque-client";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/guard";
import { useAuth } from "@/lib/auth";
import { Plus, Minus, Pencil, PackagePlus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/estoque")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "Estoque de materiais — IVI Telecom" },
      { name: "description", content: "Controle de entradas, saídas e saldo dos materiais de rede." },
      { property: "og:title", content: "Estoque de materiais — IVI Telecom" },
      { property: "og:description", content: "Controle de entradas, saídas e saldo dos materiais de rede." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstoquePage,
});

type Item = { id: string; nome: string; unidade: string; quantidade: number; minimo: number };
type Mov = { id: string; item_id: string; tipo: string; quantidade: number; observacao: string | null; created_at: string };
type Acao = { item: Item; tipo: "entrada" | "saida" | "ajuste" } | null;

function EstoquePage() {
  const { role } = useAuth();
  const podeEditar = role === "admin" || role === "operador";
  const [itens, setItens] = useState<Item[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [acao, setAcao] = useState<Acao>(null);
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const [novo, setNovo] = useState({ nome: "", minimo: "0" });
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [i, m] = await Promise.all([
      db.from("estoque_itens").select("*").order("nome"),
      db.from("estoque_movimentos").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setErro(i.error || m.error ? "Estoque indisponível. A atualização do banco local da VM precisa ser concluída." : "");
    setItens(i.data ?? []);
    setMovs(m.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acao) return;
    if (busy) return;
    const n = Number(qtd);
    if (!qtd || !Number.isSafeInteger(n) || n < 0 || (acao.tipo !== "ajuste" && n === 0)) return toast.error("Informe uma quantidade válida");
    setBusy(true);
    const { error } = await db.from("estoque_movimentos").insert({ item_id: acao.item.id, tipo: acao.tipo, quantidade: n, observacao: obs || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Movimento registrado");
    setAcao(null); setQtd(""); setObs(""); load();
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novo.nome.trim()) return;
    const { error } = await db.from("estoque_itens").insert({ nome: novo.nome.trim().toUpperCase(), minimo: parseInt(novo.minimo, 10) || 0 });
    if (error) return toast.error(error.message);
    setNovo({ nome: "", minimo: "0" }); load();
  };

  const remover = async (it: Item) => {
    if (!confirm(`Excluir ${it.nome}? Itens com movimentações não podem ser excluídos.`)) return;
    const { error } = await db.from("estoque_itens").delete().eq("id", it.id);
    if (error) return toast.error(error.message);
    load();
  };

  const nomeDe = (id: string) => itens.find((i) => i.id === id)?.nome ?? "—";
  const rotulo = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" } as Record<string, string>;

  return (
    <AppShell title="Estoque">
      <h1 className="font-display text-2xl font-bold mb-6">Estoque de materiais</h1>
      {loading && <p className="text-sm text-muted-foreground mb-4">Carregando estoque…</p>}
      {erro && <div role="alert" className="border border-destructive p-4 mb-6 text-sm text-destructive">{erro}<Button variant="outline" size="sm" className="ml-3" onClick={load}>Tentar novamente</Button></div>}

      {podeEditar && !erro && !loading && (
        <form onSubmit={criar} className="flex flex-wrap gap-2 mb-6">
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Novo item"
            className="border border-border bg-card px-3 py-2 text-sm font-mono" />
          <input type="number" min={0} value={novo.minimo} onChange={(e) => setNovo({ ...novo, minimo: e.target.value })}
            title="Estoque mínimo" className="w-28 border border-border bg-card px-3 py-2 text-sm font-mono" />
          <Button type="submit">
            <PackagePlus className="h-4 w-4" /> Adicionar item
          </Button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {itens.map((it) => {
          const baixo = it.quantidade <= it.minimo;
          return (
            <div key={it.id} className={`border bg-card p-4 ${baixo ? "border-destructive" : "border-border"}`}>
              <div className="flex justify-between items-start gap-2">
                <span className="font-mono text-xs uppercase text-muted-foreground">{it.nome}</span>
                {podeEditar && <Button variant="ghost" size="icon" onClick={() => remover(it)} title="Excluir item" aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
              <div className="text-3xl font-bold mt-2">{it.quantidade}</div>
              <div className={`text-xs mt-1 flex items-center gap-1 ${baixo ? "text-destructive" : "text-muted-foreground"}`}>
                {baixo && <AlertTriangle className="h-3 w-3" />} mínimo {it.minimo}
              </div>
              {podeEditar && (
                <div className="flex gap-1 mt-3">
                  <Button size="sm" variant="outline" onClick={() => { setQtd(""); setAcao({ item: it, tipo: "entrada" }); }} className="flex-1"><Plus className="h-3 w-3" />Entrada</Button>
                  <Button size="sm" variant="outline" onClick={() => { setQtd(""); setAcao({ item: it, tipo: "saida" }); }} className="flex-1"><Minus className="h-3 w-3" />Saída</Button>
                  <Button size="icon" variant="outline" onClick={() => { setAcao({ item: it, tipo: "ajuste" }); setQtd(String(it.quantidade)); }} title="Ajustar saldo"><Pencil className="h-3 w-3" /></Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="font-display text-lg font-semibold mb-3">Últimas movimentações</h2>
      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground font-mono"><tr>
            <th className="text-left p-2">Data</th><th className="text-left p-2">Item</th><th className="text-left p-2">Tipo</th><th className="text-right p-2">Qtd</th><th className="text-left p-2">Observação</th>
          </tr></thead>
          <tbody>
            {movs.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhuma movimentação ainda.</td></tr>}
            {movs.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-2">{nomeDe(m.item_id)}</td>
                <td className="p-2">{rotulo[m.tipo]}</td>
                <td className="p-2 text-right">{m.tipo === "saida" ? "-" : m.tipo === "entrada" ? "+" : "="}{m.quantidade}</td>
                <td className="p-2 text-muted-foreground">{m.observacao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {acao && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4" onClick={() => setAcao(null)}>
          <form onSubmit={registrar} onClick={(e) => e.stopPropagation()} className="bg-card border border-border p-6 w-full max-w-sm space-y-3">
            <h3 className="font-semibold">{rotulo[acao.tipo]} — {acao.item.nome}</h3>
            <p className="text-xs text-muted-foreground">Saldo atual: {acao.item.quantidade}</p>
            <input autoFocus type="number" min={0} value={qtd} onChange={(e) => setQtd(e.target.value)}
              placeholder={acao.tipo === "ajuste" ? "Novo saldo" : "Quantidade"} className="w-full border border-border bg-background px-3 py-2 text-sm" />
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (ex.: chamado, técnico)" className="w-full border border-border bg-background px-3 py-2 text-sm" />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setAcao(null)}>Cancelar</Button>
              <Button type="submit" disabled={busy}>Salvar</Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
