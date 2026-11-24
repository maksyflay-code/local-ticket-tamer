import { useCallback, useEffect, useRef, useState } from "react";
import { estoqueDb, type StockItem, type StockMovement } from "@/lib/estoque-client";
import { validarMateriais, type MaterialSelecionado } from "@/lib/estoque";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PackageMinus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function MateriaisOS({ solicitacaoId, editavel, onRegistrado }: {
  solicitacaoId: string; editavel: boolean; onRegistrado: () => void;
}) {
  const [itens, setItens] = useState<StockItem[]>([]);
  const [movimentos, setMovimentos] = useState<StockMovement[]>([]);
  const [linhas, setLinhas] = useState<MaterialSelecionado[]>([{ item_id: "", quantidade: 1 }]);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const operacao = useRef<string | null>(null);
  const enviando = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [i, m] = await Promise.all([
      estoqueDb.from("estoque_itens").select("*").order("nome"),
      estoqueDb.from("estoque_movimentos").select("*").eq("solicitacao_id", solicitacaoId).order("created_at", { ascending: false }),
    ]);
    setErro(i.error || m.error ? "Estoque indisponível. A atualização do banco local precisa ser concluída." : "");
    setItens(i.data ?? []); setMovimentos(m.data ?? []); setLoading(false);
  }, [solicitacaoId]);

  useEffect(() => { void load(); }, [load]);

  function alterar(index: number, valor: Partial<MaterialSelecionado>) {
    operacao.current = null;
    setLinhas((ls) => ls.map((l, ix) => ix === index ? { ...l, ...valor } : l));
  }

  async function registrar() {
    if (enviando.current || !editavel) return;
    const validation = validarMateriais(linhas, new Map(itens.map((i) => [i.id, i.quantidade])));
    if (validation) return toast.error(validation);
    enviando.current = true; setBusy(true);
    operacao.current ??= crypto.randomUUID();
    try {
      const { error } = await estoqueDb.rpc("registrar_materiais_os", {
        p_solicitacao_id: solicitacaoId, p_operacao_id: operacao.current,
        p_materiais: linhas.map((l) => ({ item_id: l.item_id, quantidade: l.quantidade })),
        p_observacao: observacao.trim(),
      });
      if (error) { toast.error("Não foi possível baixar os materiais", { description: error.message }); return; }
      toast.success("Materiais registrados e baixados do estoque");
      setLinhas([{ item_id: "", quantidade: 1 }]); setObservacao(""); operacao.current = null;
      await load(); onRegistrado();
    } catch { toast.error("Falha de conexão. Tente novamente para confirmar a mesma baixa."); }
    finally { enviando.current = false; setBusy(false); }
  }

  return <section className="space-y-3 border-t border-border pt-4">
    <h3 className="font-semibold flex items-center gap-2"><PackageMinus className="h-4 w-4" />Materiais utilizados na OS</h3>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : <>
      {movimentos.length > 0 ? <ul className="space-y-2">{movimentos.map((m) => <li key={m.id} className="text-sm border-b border-border pb-2">
        <span className="font-medium">{m.quantidade} × {itens.find((i) => i.id === m.item_id)?.nome ?? "Material"}</span>
        <span className="block text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")} · {m.observacao}</span>
      </li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum material utilizado registrado.</p>}
      {editavel && <div className="space-y-3">
        {linhas.map((l, ix) => <div key={ix} className="grid grid-cols-[minmax(0,1fr)_80px_36px] gap-2 items-end">
          <div className="space-y-1"><Label htmlFor={`material-${ix}`}>Material</Label>
            <Select value={l.item_id} onValueChange={(v) => alterar(ix, { item_id: v })} disabled={busy}>
              <SelectTrigger id={`material-${ix}`} className="w-full min-w-0"><SelectValue placeholder="Selecionar material" /></SelectTrigger>
              <SelectContent>{itens.map((i) => <SelectItem key={i.id} value={i.id}>{i.nome} · saldo {i.quantidade} {i.unidade}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor={`quantidade-${ix}`}>Qtd.</Label><Input id={`quantidade-${ix}`} type="number" min={1} step={1} value={l.quantidade} disabled={busy} onChange={(e) => alterar(ix, { quantidade: Number(e.target.value) })} /></div>
          <Button size="icon" variant="ghost" title="Remover material" aria-label="Remover material" disabled={busy || linhas.length === 1} onClick={() => { operacao.current = null; setLinhas((ls) => ls.filter((_, n) => n !== ix)); }}><Trash2 className="h-4 w-4" /></Button>
        </div>)}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { operacao.current = null; setLinhas((ls) => [...ls, { item_id: "", quantidade: 1 }]); }}><Plus className="h-4 w-4" />Adicionar material</Button>
        <div className="space-y-1"><Label htmlFor="material-observacao">Trecho / técnico / observação</Label><Input id="material-observacao" value={observacao} disabled={busy} onChange={(e) => { operacao.current = null; setObservacao(e.target.value); }} /></div>
        <div className="flex justify-end"><Button disabled={busy || itens.length === 0} onClick={registrar}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageMinus className="h-4 w-4" />}Registrar utilização e baixar estoque</Button></div>
      </div>}
    </>}
  </section>;
}