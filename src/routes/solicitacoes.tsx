import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listAllSystemUsers } from "@/lib/operators.functions";
import { authHeaders } from "@/lib/server-call";
import {
  TIPOS,
  TIPOS_MAP,
  STATUS_META,
  CAMPOS_POR_TIPO,
  defaultTituloForTipo,
  type SolicitacaoTipo,
  type SolicitacaoStatus,
  type CampoDef,
} from "@/lib/solicitacoes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Solicitacao = {
  id: string;
  numero: number;
  tipo: SolicitacaoTipo;
  titulo: string;
  descricao: string | null;
  status: SolicitacaoStatus;
  prioridade: string;
  solicitante_id: string | null;
  solicitante_email: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  dados: Record<string, unknown>;
  created_at: string;
  iniciada_at: string | null;
  concluida_at: string | null;
  cancelada_at: string | null;
};

type HistoricoItem = {
  id: string;
  tipo: string;
  descricao: string;
  status_anterior: string | null;
  status_novo: string | null;
  autor: string | null;
  created_at: string;
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

export const Route = createFileRoute("/solicitacoes")({
  component: SolicitacoesPage,
});

function SolicitacoesPage() {
  const { user, canWrite } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterTipo, setFilterTipo] = useState<SolicitacaoTipo | "todos">("todos");
  const [filterStatus, setFilterStatus] = useState<SolicitacaoStatus | "todos">("todos");

  const [picker, setPicker] = useState(false);
  const [createTipo, setCreateTipo] = useState<SolicitacaoTipo | null>(null);
  const [detalhe, setDetalhe] = useState<Solicitacao | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("solicitacoes:open-new")) {
      sessionStorage.removeItem("solicitacoes:open-new");
      setPicker(true);
    }
  }, []);

  const fetchOperadores = useServerFn(listAllSystemUsers);
  const [opMap, setOpMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchOperadores({ headers: await authHeaders() });
        const m = new Map<string, string>();
        for (const u of list as unknown as Array<{ email: string; name: string | null }>) {
          if (u.email) m.set(u.email.toLowerCase(), (u.name?.trim() || u.email));
        }
        setOpMap(m);
      } catch {
        /* ignore */
      }
    })();
  }, [fetchOperadores]);
  const nameOf = (email?: string | null) =>
    !email ? "—" : (opMap.get(email.toLowerCase()) ?? email);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Erro ao carregar solicitações", { description: error.message });
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as Solicitacao[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("solicitacoes-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitacoes" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterTipo !== "todos" && it.tipo !== filterTipo) return false;
      if (filterStatus !== "todos" && it.status !== filterStatus) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        if (
          !it.titulo.toLowerCase().includes(s) &&
          !String(it.numero).includes(s) &&
          !(it.descricao ?? "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [items, q, filterTipo, filterStatus]);

  const stats = useMemo(() => {
    const c = { aberta: 0, em_andamento: 0, concluida: 0, cancelada: 0 };
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);

  return (
    <AppShell title="Solicitações Internas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Solicitações</h2>
            <p className="text-sm text-muted-foreground">
              Centralize trânsitos, RFOs, compras, manutenções e mais.
            </p>
          </div>
          {canWrite && (
            <Button onClick={() => setPicker(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova solicitação
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["aberta", "em_andamento", "concluida", "cancelada"] as SolicitacaoStatus[]).map((s) => (
            <div
              key={s}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="text-[10px] uppercase font-mono text-muted-foreground">
                {STATUS_META[s].label}
              </div>
              <div className="text-2xl font-bold mt-1">{stats[s]}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número, título ou descrição"
              className="pl-9"
            />
          </div>
          <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as typeof filterTipo)}>
            <SelectTrigger className="md:w-56">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.short}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(STATUS_META) as SolicitacaoStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground p-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada.</p>
            {canWrite && (
              <Button onClick={() => setPicker(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Criar primeira solicitação
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((it) => {
              const meta = TIPOS_MAP[it.tipo];
              const Icon = meta.icon;
              const st = STATUS_META[it.status];
              return (
                <button
                  key={it.id}
                  onClick={() => setDetalhe(it)}
                  className="w-full text-left rounded-lg border border-border bg-card hover:bg-secondary/40 transition-colors p-4 flex items-start gap-4"
                >
                  <div className={cn("h-10 w-10 rounded-md border border-border flex items-center justify-center shrink-0", meta.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">#{it.numero}</span>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {meta.short}
                      </Badge>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded border font-mono uppercase", st.cls)}>
                        {st.label}
                      </span>
                    </div>
                    <div className="font-medium mt-1 truncate">{it.titulo}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmt(it.created_at)}
                      </span>
                      {it.solicitante_email && <span>por {nameOf(it.solicitante_email)}</span>}
                      {it.responsavel_nome && <span>resp.: {it.responsavel_nome}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Picker de tipo */}
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova solicitação</DialogTitle>
            <DialogDescription>Escolha o tipo de solicitação a criar.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TIPOS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setPicker(false);
                    setCreateTipo(t.value);
                  }}
                  className="text-left rounded-lg border border-border bg-card hover:bg-secondary/40 p-3 flex items-start gap-3 transition-colors"
                >
                  <div className={cn("h-9 w-9 rounded-md border border-border flex items-center justify-center shrink-0", t.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de criação */}
      <CriarSolicitacaoModal
        tipo={createTipo}
        onClose={() => setCreateTipo(null)}
        onCreated={(novo) => {
          setCreateTipo(null);
          load();
          setDetalhe(novo);
        }}
        userId={user?.id ?? null}
        userEmail={user?.email ?? null}
      />

      {/* Modal de detalhe */}
      <DetalheModal
        item={detalhe}
        onClose={() => setDetalhe(null)}
        onChanged={() => load()}
        canWrite={canWrite}
        currentUserId={user?.id ?? null}
        currentUserEmail={user?.email ?? null}
        navigateRfo={() => detalhe && navigate({ to: "/rfo" })}
        navigateTransito={() => detalhe && navigate({ to: "/transito-vtal" })}
        nameOf={nameOf}
      />
    </AppShell>
  );
}

/* ---------- Criar ---------- */

function CriarSolicitacaoModal({
  tipo,
  onClose,
  onCreated,
  userId,
  userEmail,
}: {
  tipo: SolicitacaoTipo | null;
  onClose: () => void;
  onCreated: (s: Solicitacao) => void;
  userId: string | null;
  userEmail: string | null;
}) {
  const [dados, setDados] = useState<Record<string, string>>({});
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [operadores, setOperadores] = useState<
    { id: string; email: string; name: string | null }[]
  >([]);
  const fetchOperadores = useServerFn(listAllSystemUsers);

  useEffect(() => {
    setDados({});
    setTitulo("");
    setDescricao("");
    setResponsavelId("");
  }, [tipo]);

  useEffect(() => {
    if (!tipo) return;
    let active = true;
    (async () => {
      try {
        const list = await fetchOperadores({ headers: await authHeaders() });
        if (!active) return;
        setOperadores(
          (list ?? []).map((u) => ({
            id: u.id,
            email: u.email,
            name: (u as { name?: string | null }).name ?? null,
          })),
        );
      } catch {
        if (active) setOperadores([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [tipo, fetchOperadores]);

  if (!tipo) return null;
  const meta = TIPOS_MAP[tipo];
  const campos = CAMPOS_POR_TIPO[tipo];
  const Icon = meta.icon;

  const updateField = (name: string, value: string) =>
    setDados((d) => ({ ...d, [name]: value }));

  async function submit() {
    // valida required
    for (const c of campos) {
      if (c.required && !(dados[c.name] ?? "").trim()) {
        toast.error(`Campo obrigatório: ${c.label}`);
        return;
      }
    }
    setSubmitting(true);
    const tit = titulo.trim() || defaultTituloForTipo(tipo!, dados);
    const resp = operadores.find((o) => o.id === responsavelId);
    const respNome = resp ? resp.name || resp.email : null;
    const { data, error } = await supabase
      .from("solicitacoes")
      .insert({
        tipo: tipo!,
        titulo: tit,
        descricao: descricao.trim() || null,
        solicitante_id: userId,
        solicitante_email: userEmail,
        responsavel_id: resp ? resp.id : null,
        responsavel_nome: respNome,
        dados: dados as never,
      } as never)
      .select("*")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Erro ao criar solicitação", { description: error?.message });
      return;
    }
    toast.success("Solicitação criada");
    onCreated(data as unknown as Solicitacao);
  }

  return (
    <Dialog open={!!tipo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", meta.color)} /> {meta.label}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="(opcional — gerado automaticamente)"
            />
          </div>

          {campos.map((c) => (
            <CampoInput
              key={c.name}
              campo={c}
              value={dados[c.name] ?? ""}
              onChange={(v) => updateField(c.name, v)}
            />
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="responsavel">Responsável</Label>
            <Select
              value={responsavelId || "nenhum"}
              onValueChange={(v) => setResponsavelId(v === "nenhum" ? "" : v)}
            >
              <SelectTrigger id="responsavel">
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Sem responsável</SelectItem>
                {operadores.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name ? `${o.name} (${o.email})` : o.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Observações gerais</Label>
            <Textarea
              id="descricao"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampoInput({
  campo,
  value,
  onChange,
}: {
  campo: CampoDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `f-${campo.name}`;
  const label = (
    <Label htmlFor={id}>
      {campo.label}
      {campo.required && <span className="text-destructive ml-1">*</span>}
    </Label>
  );

  if (campo.type === "textarea") {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea
          id={id}
          rows={campo.rows ?? 3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.placeholder}
          className="resize-none"
        />
      </div>
    );
  }
  if (campo.type === "select") {
    return (
      <div className="space-y-1.5">
        {label}
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Selecionar…" />
          </SelectTrigger>
          <SelectContent>
            {campo.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {label}
      <Input
        id={id}
        type={campo.type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={campo.placeholder}
        min={campo.min}
        step={campo.step}
      />
    </div>
  );
}

/* ---------- Detalhe ---------- */

function DetalheModal({
  item,
  onClose,
  onChanged,
  canWrite,
  currentUserId,
  currentUserEmail,
  navigateRfo,
  navigateTransito,
  nameOf,
}: {
  item: Solicitacao | null;
  onClose: () => void;
  onChanged: () => void;
  canWrite: boolean;
  currentUserId: string | null;
  currentUserEmail: string | null;
  navigateRfo: () => void;
  navigateTransito: () => void;
  nameOf: (email?: string | null) => string;
}) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) {
      setHistorico([]);
      setComentario("");
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("solicitacao_historico")
        .select("*")
        .eq("solicitacao_id", item.id)
        .order("created_at", { ascending: false });
      if (active) setHistorico((data ?? []) as unknown as HistoricoItem[]);
    })();
    return () => {
      active = false;
    };
  }, [item]);

  if (!item) return null;

  const meta = TIPOS_MAP[item.tipo];
  const st = STATUS_META[item.status];
  const Icon = meta.icon;
  const finalizada = item.status === "concluida" || item.status === "cancelada";
  const campos = CAMPOS_POR_TIPO[item.tipo];

  async function changeStatus(novoStatus: SolicitacaoStatus, extra: Partial<Solicitacao> = {}) {
    if (!item || !canWrite) return;
    setBusy(true);
    const payload: Record<string, unknown> = { status: novoStatus, ...extra };
    if (novoStatus === "em_andamento" && !item.iniciada_at) {
      payload.iniciada_at = new Date().toISOString();
      payload.responsavel_id = currentUserId;
      payload.responsavel_nome = currentUserEmail;
    }
    if (novoStatus === "concluida") payload.concluida_at = new Date().toISOString();
    if (novoStatus === "cancelada") payload.cancelada_at = new Date().toISOString();

    const { error } = await supabase
      .from("solicitacoes")
      .update(payload as never)
      .eq("id", item.id);
    setBusy(false);
    if (error) {
      toast.error("Falha ao atualizar", { description: error.message });
      return;
    }
    toast.success("Solicitação atualizada");
    onChanged();
    onClose();
  }

  async function addComentario() {
    const txt = comentario.trim();
    if (!txt || !item) return;
    if (txt.length < 2) return;
    setBusy(true);
    const { error } = await supabase.from("solicitacao_historico").insert({
      solicitacao_id: item.id,
      tipo: "comentario",
      descricao: txt,
      autor: currentUserEmail,
    } as never);
    setBusy(false);
    if (error) {
      toast.error("Falha ao comentar", { description: error.message });
      return;
    }
    setComentario("");
    // recarrega histórico
    const { data } = await supabase
      .from("solicitacao_historico")
      .select("*")
      .eq("solicitacao_id", item.id)
      .order("created_at", { ascending: false });
    setHistorico((data ?? []) as unknown as HistoricoItem[]);
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Icon className={cn("h-5 w-5", meta.color)} />
            <span>#{item.numero}</span>
            <span className="truncate">{item.titulo}</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded border font-mono uppercase", st.cls)}>
              {st.label}
            </span>
          </DialogTitle>
          <DialogDescription>
            {meta.label} · criada {fmt(item.created_at)}
            {item.solicitante_email && ` · por ${nameOf(item.solicitante_email)}`}
          </DialogDescription>
        </DialogHeader>

        {/* Dados */}
        <div className="rounded-md border border-border bg-secondary/30 p-3">
          <div className="text-[10px] uppercase font-mono text-muted-foreground mb-2">Dados</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {campos.map((c) => {
              const v = item.dados?.[c.name];
              if (v == null || v === "") return null;
              return (
                <div key={c.name}>
                  <div className="text-[11px] text-muted-foreground">{c.label}</div>
                  <div className="whitespace-pre-wrap break-words">{String(v)}</div>
                </div>
              );
            })}
          </div>
          {item.descricao && (
            <div className="mt-3 pt-3 border-t border-border/60">
              <div className="text-[11px] text-muted-foreground">Observações</div>
              <div className="whitespace-pre-wrap text-sm">{item.descricao}</div>
            </div>
          )}
        </div>

        {/* Ações */}
        {canWrite && !finalizada && (
          <div className="flex flex-wrap gap-2">
            {item.status === "aberta" && (
              <Button onClick={() => changeStatus("em_andamento")} disabled={busy} className="gap-2">
                <Play className="h-4 w-4" /> Iniciar atendimento
              </Button>
            )}
            <Button onClick={() => changeStatus("cancelada")} disabled={busy} variant="outline" className="gap-2">
              <XCircle className="h-4 w-4" /> Cancelar
            </Button>
            {item.tipo === "rfo" && (
              <Button variant="outline" className="gap-2" onClick={navigateRfo}>
                <FileText className="h-4 w-4" /> Gerar PDF (RFO)
              </Button>
            )}
            {item.tipo === "transito" && (
              <Button variant="outline" className="gap-2" onClick={navigateTransito}>
                <FileText className="h-4 w-4" /> Gerar PDF (Trânsito)
              </Button>
            )}
          </div>
        )}

        {/* Comentário */}
        {canWrite && !finalizada && (
          <div className="space-y-2">
            <Label htmlFor="cmt">Adicionar comentário</Label>
            <Textarea
              id="cmt"
              rows={2}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={addComentario} disabled={busy || !comentario.trim()}>
                Comentar
              </Button>
              <Button
                size="sm"
                onClick={() => changeStatus("concluida")}
                disabled={busy}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4" /> Concluir
              </Button>
            </div>
          </div>
        )}

        {/* Histórico */}
        <div>
          <div className="text-[10px] uppercase font-mono text-muted-foreground mb-2">Histórico</div>
          {historico.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum evento.</div>
          ) : (
            <ol className="space-y-2">
              {historico.map((h) => (
                <li key={h.id} className="text-sm border-l-2 border-border pl-3 py-1">
                  <div className="text-[11px] font-mono uppercase text-muted-foreground">
                    {h.tipo} · {fmt(h.created_at)} {h.autor && `· ${nameOf(h.autor)}`}
                  </div>
                  <div className="whitespace-pre-wrap">{h.descricao}</div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}