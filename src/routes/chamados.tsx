import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth } from "@/lib/guard";
import { useAuth } from "@/lib/auth";
import { Plus, Search, Trash2, Pencil, Paperclip, MessageSquare, Clock, Download, X, UserCheck, AlertTriangle, ChevronLeft, ChevronRight, Hand, UserMinus, RotateCcw, Copy, Pause, Play, CheckCircle2, Building2, Tag, AlertCircle, User, CalendarClock, PlayCircle, StopCircle, Timer, FileText, Upload, Hash, History } from "lucide-react";
import { toast } from "sonner";
import { listAssignableOperators } from "@/lib/operators.functions";
import { authHeaders } from "@/lib/server-call";
import { getSlaMap, calcSla, formatHorasRestantes, type SlaMap } from "@/lib/sla";
import { triggerPushForChamado } from "@/lib/push.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/chamados")({
  beforeLoad: requireAuth,
  component: ChamadosPage,
});

type Status = "aberto" | "aguardando_cliente" | "resolvido" | "fechado";
type Prioridade = "baixa" | "media" | "alta" | "urgente";
type TipoProblema = "ROMPIMENTO" | "ATENUACAO" | "FALHA_ELETRICA" | "FLAP" | "VERIFICACAO_ROTAS" | "OUTROS";

type Chamado = {
  id: string;
  numero: number;
  codigo: string | null;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  tipo_problema: string | null;
  status: Status;
  prioridade: Prioridade;
  tecnico_responsavel: string | null;
  responsavel_id: string | null;
  resolvido_at: string | null;
  created_at: string;
  iniciado_at: string | null;
  finalizado_at: string | null;
  clientes: { nome: string } | null;
};

type Cliente = { id: string; nome: string };
type Operator = { id: string; email: string; name: string | null; role: string };
type Historico = { id: string; tipo: string; descricao: string; autor: string | null; created_at: string; status_anterior: string | null; status_novo: string | null };
type Anexo = { id: string; nome_arquivo: string; storage_path: string; mime_type: string | null; tamanho: number | null; created_at: string };

const empty: Partial<Chamado> = { status: "aberto", prioridade: "media" };

const TIPOS_PROBLEMA: { value: TipoProblema; label: string }[] = [
  { value: "ROMPIMENTO", label: "Rompimento" },
  { value: "ATENUACAO", label: "Atenuação" },
  { value: "FALHA_ELETRICA", label: "Falha Elétrica" },
  { value: "FLAP", label: "Flap" },
  { value: "VERIFICACAO_ROTAS", label: "Verificação de Rotas" },
  { value: "OUTROS", label: "Outros" },
];

const ticketLabel = (c: Pick<Chamado, "codigo" | "numero">) =>
  c.codigo ?? `#TK-${String(c.numero).padStart(4, "0")}`;

const statusBadge = (s: Status) => ({
  aberto: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  aguardando_cliente: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  resolvido: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  fechado: "border-white/10 bg-white/5 text-muted-foreground",
})[s];

const prioridadeColor = (p: Prioridade) => ({
  urgente: "text-red-400",
  alta: "text-orange-400",
  media: "text-yellow-400",
  baixa: "text-muted-foreground",
})[p];

// Converte ISO -> valor para <input type="datetime-local"> (timezone local)
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}
function formatDuracao(ini: string | null, fim: string | null, opts?: { emAndamento?: boolean }): string {
  if (!ini) return "—";
  const fimMs = fim ? new Date(fim).getTime() : Date.now();
  const ms = fimMs - new Date(ini).getTime();
  if (ms < 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const base = `${h}h ${m}m`;
  return !fim && opts?.emAndamento ? `${base} (em andamento)` : base;
}

const PAGE_SIZE = 20;

function ChamadosPage() {
  const { user, canWrite, isAdmin } = useAuth();
  const [items, setItems] = useState<Chamado[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "todos";
    const s = sessionStorage.getItem("chamados:initial-status");
    if (s) sessionStorage.removeItem("chamados:initial-status");
    return s && ["aberto", "aguardando_cliente", "resolvido", "fechado"].includes(s) ? s : "todos";
  });
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>("todos");
  const [responsavelFilter, setResponsavelFilter] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Chamado>>(empty);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [detail, setDetail] = useState<Chamado | null>(null);
  const [slaMap, setSlaMap] = useState<SlaMap | null>(null);

  useEffect(() => { getSlaMap().then(setSlaMap); }, []);

  // Mantemos um ref atualizado com operadores para uso dentro dos handlers do realtime
  const operatorsRef = useRef<Operator[]>([]);
  useEffect(() => { operatorsRef.current = operators; }, [operators]);
  const nameOf = (email?: string | null) => {
    if (!email) return "sistema";
    const op = operatorsRef.current.find((o) => o.email === email);
    return op?.name?.trim() || email;
  };

  // debounce de busca
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // resetar paginação quando filtros mudam
  useEffect(() => { setPage(0); }, [searchDebounced, statusFilter, prioridadeFilter, responsavelFilter]);

  const load = async () => {
    let q = supabase
      .from("chamados")
      .select("*, clientes(nome)", { count: "exact" })
      .order("created_at", { ascending: false });
    if (statusFilter !== "todos") q = q.eq("status", statusFilter as never);
    if (prioridadeFilter !== "todos") q = q.eq("prioridade", prioridadeFilter as never);
    if (responsavelFilter === "meus" && user?.id) q = q.eq("responsavel_id", user.id);
    else if (responsavelFilter === "nao_atribuidos") q = q.is("responsavel_id", null);
    else if (responsavelFilter !== "todos" && responsavelFilter !== "meus") q = q.eq("responsavel_id", responsavelFilter);
    if (searchDebounced.trim()) {
      const s = searchDebounced.trim().replace(/[%,]/g, "");
      const asNum = Number(s);
      if (Number.isInteger(asNum) && asNum > 0) {
        q = q.or(`titulo.ilike.%${s}%,numero.eq.${asNum}`);
      } else {
        q = q.ilike("titulo", `%${s}%`);
      }
    }
    const from = page * PAGE_SIZE;
    q = q.range(from, from + PAGE_SIZE - 1);
    const { data, error, count } = await q;
    if (error) toast.error(error.message);
    setItems((data as unknown as Chamado[]) ?? []);
    setTotal(count ?? 0);
    const { data: cl } = await supabase.from("clientes").select("id, nome").order("nome");
    setClientes((cl as Cliente[]) ?? []);
    try {
      const ops = await listAssignableOperators({ headers: await authHeaders() });
      setOperators(ops as Operator[]);
    } catch {
      // visualizador sem operadores: ignora
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, searchDebounced, statusFilter, prioridadeFilter, responsavelFilter, user?.id]);

  // Realtime: recarrega a lista e notifica quando qualquer chamado muda
  useEffect(() => {
    const codeOf = (r: { codigo?: string | null; numero?: number | null } | null | undefined) =>
      r?.codigo ?? (r?.numero != null ? `#TK-${String(r.numero).padStart(4, "0")}` : "");
    const openChamado = async (id: string) => {
      const { data } = await supabase
        .from("chamados").select("*, clientes(nome)").eq("id", id).maybeSingle();
      if (data) setDetail(data as unknown as Chamado);
    };
    const actionFor = (id: string) => ({ label: "Abrir", onClick: () => { void openChamado(id); } });
    const ACTION_LABEL: Record<string, string> = {
      relato: "Relato adicionado",
      mudanca_status: "Status atualizado",
      mudanca_prioridade: "Prioridade atualizada",
      mudanca_responsavel: "Responsável atualizado",
      anexo: "Anexo enviado",
      criacao: "Chamado criado",
    };
    const channel = supabase
      .channel("chamados-list-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chamados" },
        (payload) => {
          const n = payload.new as { id: string; codigo?: string | null; numero?: number | null; titulo?: string };
          toast.info(`Novo chamado ${codeOf(n)}`, {
            description: n.titulo ?? undefined,
            action: actionFor(n.id),
          });
          load();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chamados" },
        () => { load(); },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chamados" },
        () => { load(); },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chamado_historico" },
        async (payload) => {
          const h = payload.new as { chamado_id: string; tipo?: string; descricao?: string; autor?: string | null };
          const { data: c } = await supabase
            .from("chamados").select("codigo, numero, titulo").eq("id", h.chamado_id).maybeSingle();
          const code = codeOf(c as { codigo?: string | null; numero?: number | null } | null);
          const titulo = ACTION_LABEL[h.tipo ?? ""] ?? "Atualização";
          const isFinal = h.tipo === "mudanca_status" && /resolvido|fechado/i.test(h.descricao ?? "");
          const head = `${titulo} • ${code}`;
          const desc = `por ${nameOf(h.autor)}${h.descricao ? ` — ${h.descricao}` : ""}`;
          const opts = { description: desc, action: actionFor(h.chamado_id) };
          if (isFinal) toast.success(head, opts);
          else if (h.tipo === "relato") toast.info(head, opts);
          else toast.message(head, opts);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [page, searchDebounced, statusFilter, prioridadeFilter, responsavelFilter, user?.id]);

  // Abertura automática via deeplink (ex: vindo da página de cliente)
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Pré-preencher cliente em "Novo chamado" (vindo da aba do cliente)
    const preCli = sessionStorage.getItem("chamados:prefill-cliente");
    if (preCli) {
      sessionStorage.removeItem("chamados:prefill-cliente");
      setForm({ ...empty, cliente_id: preCli });
      setOpen(true);
    }
    if (sessionStorage.getItem("chamados:open-new")) {
      sessionStorage.removeItem("chamados:open-new");
      setForm(empty);
      setOpen(true);
    }
    const openId = sessionStorage.getItem("chamados:open-id");
    if (!openId) return;
    sessionStorage.removeItem("chamados:open-id");
    (async () => {
      const { data } = await supabase.from("chamados").select("*, clientes(nome)").eq("id", openId).maybeSingle();
      if (data) setDetail(data as unknown as Chamado);
    })();
  }, []);

  const opEmailById = useMemo(() => {
    const m = new Map<string, string>();
    operators.forEach((o) => m.set(o.id, o.email));
    return m;
  }, [operators]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return toast.error("Você não tem permissão para alterar chamados.");
    if (!form.titulo) return toast.error("Título obrigatório");
    const payload: Record<string, unknown> = { ...form };
    delete payload.clientes;
    delete payload.id;
    delete payload.numero;
    if (payload.responsavel_id === "") payload.responsavel_id = null;
    // mantém tecnico_responsavel sincronizado com o e-mail do responsável escolhido
    if (payload.responsavel_id) {
      const email = opEmailById.get(payload.responsavel_id as string);
      if (email) payload.tecnico_responsavel = email;
    }
    if (payload.status === "resolvido" && !payload.resolvido_at) {
      payload.resolvido_at = new Date().toISOString();
    }
    if (payload.status !== "resolvido" && payload.status !== "fechado") {
      payload.resolvido_at = null;
    }
    // Auto: ao abrir o chamado, registra iniciado_at; ao resolver, finalizado_at
    if (payload.status === "aberto" && !payload.iniciado_at) {
      payload.iniciado_at = new Date().toISOString();
    }
    if (payload.status === "resolvido" && !payload.finalizado_at) {
      payload.finalizado_at = new Date().toISOString();
    }
    // Quem finaliza vira o responsável (entra nas estatísticas por técnico)
    if ((payload.status === "resolvido" || payload.status === "fechado") && user?.id) {
      payload.responsavel_id = user.id;
      payload.tecnico_responsavel = user.email ?? opEmailById.get(user.id) ?? null;
    }
    let chamadoId = form.id as string | undefined;
    if (chamadoId) {
      const { error } = await supabase.from("chamados").update(payload as never).eq("id", chamadoId);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("chamados").insert(payload as never).select("id").single();
      if (error) return toast.error(error.message);
      chamadoId = (data as { id: string }).id;
    }
    // Upload de anexos pendentes
    if (chamadoId && pendingFiles.length > 0) {
      const autorEmail = user?.email ?? "operador";
      for (const file of pendingFiles) {
        try {
          const path = `${chamadoId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("chamado-anexos").upload(path, file);
          if (upErr) throw upErr;
          await supabase.from("chamado_anexos").insert({
            chamado_id: chamadoId, nome_arquivo: file.name, storage_path: path,
            mime_type: file.type, tamanho: file.size,
          } as never);
          await supabase.from("chamado_historico").insert({
            chamado_id: chamadoId, tipo: "anexo", descricao: `Anexo enviado: ${file.name}`, autor: autorEmail,
          } as never);
        } catch (err) {
          toast.error(`Falha ao enviar ${file.name}: ${err instanceof Error ? err.message : "erro"}`);
        }
      }
    }
    toast.success(form.id ? "Chamado atualizado" : "Chamado aberto");
    setOpen(false);
    setForm(empty);
    setPendingFiles([]);
    load();
  };

  const remove = async (id: string) => {
    if (!isAdmin) return toast.error("Apenas administradores podem excluir.");
    if (!confirm("Excluir este chamado?")) return;
    const { error } = await supabase.from("chamados").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Chamado removido");
    load();
  };

  const pegarParaMim = async (c: Chamado) => {
    if (!canWrite || !user) return toast.error("Sem permissão.");
    const { error } = await supabase.from("chamados")
      .update({ responsavel_id: user.id, tecnico_responsavel: user.email } as never)
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Chamado atribuído a você");
    load();
  };
  const liberar = async (c: Chamado) => {
    if (!canWrite || !user) return toast.error("Sem permissão.");
    if (!isAdmin && c.responsavel_id !== user.id) return toast.error("Apenas o responsável ou um admin pode liberar.");
    const { error } = await supabase.from("chamados")
      .update({ responsavel_id: null, tecnico_responsavel: null } as never)
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Chamado liberado");
    load();
  };
  const reabrir = async (c: Chamado) => {
    if (!isAdmin) return toast.error("Apenas administradores podem reabrir.");
    if (!confirm(`Reabrir o chamado ${ticketLabel(c)}?`)) return;
    const { error } = await supabase.from("chamados")
      .update({ status: "aberto", resolvido_at: null, finalizado_at: null } as never)
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Chamado reaberto");
    load();
  };

  const togglePausa = async (c: Chamado) => {
    if (!canWrite) return toast.error("Sem permissão.");
    const novo = c.status === "aguardando_cliente" ? "aberto" : "aguardando_cliente";
    const { error } = await supabase.from("chamados")
      .update({ status: novo } as never)
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(novo === "aguardando_cliente" ? "SLA pausado · aguardando cliente" : "SLA retomado");
    load();
  };

  const addRelatoRapido = async (c: Chamado) => {
    if (!canWrite) return toast.error("Sem permissão.");
    setRelatoModal({ chamado: c, texto: "" });
  };

  const [relatoModal, setRelatoModal] = useState<{ chamado: Chamado; texto: string } | null>(null);
  const [relatoSubmitting, setRelatoSubmitting] = useState(false);

  const [finalizarModal, setFinalizarModal] = useState<{ chamado: Chamado; texto: string } | null>(null);
  const [finalizarSubmitting, setFinalizarSubmitting] = useState(false);

  const openFinalizar = (c: Chamado) => {
    if (!canWrite) return toast.error("Sem permissão.");
    if (c.status === "resolvido" || c.status === "fechado") {
      return toast.error("Este chamado já está finalizado.");
    }
    setFinalizarModal({ chamado: c, texto: "" });
  };

  const submitFinalizar = async () => {
    if (!finalizarModal) return;
    const texto = finalizarModal.texto.trim();
    if (texto.length > 2000) return toast.error("Máximo de 2000 caracteres.");
    if (!canWrite) return toast.error("Sem permissão.");
    const c0 = finalizarModal.chamado;
    if (c0.status === "resolvido" || c0.status === "fechado") {
      setFinalizarModal(null);
      return toast.error("Este chamado já está finalizado.");
    }
    setFinalizarSubmitting(true);
    // Re-checa no banco para evitar finalizar algo já finalizado por outro operador
    const { data: atual, error: checkErr } = await supabase
      .from("chamados")
      .select("status")
      .eq("id", c0.id)
      .maybeSingle();
    if (checkErr) {
      setFinalizarSubmitting(false);
      return toast.error(checkErr.message);
    }
    if (atual && (atual.status === "resolvido" || atual.status === "fechado")) {
      setFinalizarSubmitting(false);
      setFinalizarModal(null);
      toast.error("Este chamado já foi finalizado.");
      load();
      return;
    }
    const c = c0;
    const autor = user?.email ?? "operador";
    const autorNome = operatorsRef.current.find((o) => o.email === autor)?.name?.trim() || autor;
    const now = new Date().toISOString();
    const effectiveRespId = c.responsavel_id ?? user?.id ?? null;
    const effectiveTecnico = c.tecnico_responsavel ?? autor;
    const payload: Record<string, unknown> = {
      status: "resolvido",
      resolvido_at: now,
      finalizado_at: now,
      responsavel_id: effectiveRespId,
      tecnico_responsavel: effectiveTecnico,
    };
    if (texto.length >= 3) {
      await supabase.from("chamado_historico").insert({
        chamado_id: c.id, tipo: "relato", descricao: texto, autor,
      } as never);
      void triggerPushForChamado({
        headers: await authHeaders(),
        data: { chamadoId: c.id, tipo: "relato", descricao: texto, autorNome },
      }).catch(() => {});
    }
    const { error } = await supabase.from("chamados").update(payload as never).eq("id", c.id);
    setFinalizarSubmitting(false);
    if (error) return toast.error(error.message);
    // Registra evento de finalização sempre (mesmo sem texto), para o relatório
    await supabase.from("chamado_historico").insert({
      chamado_id: c.id,
      tipo: "finalizacao",
      descricao: texto.length >= 3
        ? `Atendimento finalizado por ${autorNome}. Relato: ${texto}`
        : `Atendimento finalizado por ${autorNome}`,
      status_anterior: c.status,
      status_novo: "resolvido",
      autor,
    } as never);
    void triggerPushForChamado({
      headers: await authHeaders(),
      data: {
        chamadoId: c.id,
        tipo: "finalizacao",
        descricao: `Status alterado de ${c.status} para resolvido`,
        autorNome,
      },
    }).catch(() => {});
    toast.success("Chamado finalizado");
    setFinalizarModal(null);
    load();
  };

  const submitRelato = async () => {
    if (!relatoModal) return;
    const texto = relatoModal.texto.trim();
    if (texto.length < 3) return toast.error("Mínimo de 3 caracteres.");
    if (texto.length > 2000) return toast.error("Máximo de 2000 caracteres.");
    if (!canWrite) return toast.error("Sem permissão.");
    setRelatoSubmitting(true);
    const c = relatoModal.chamado;
    const autor = user?.email ?? "operador";
    const { error } = await supabase.from("chamado_historico").insert({
      chamado_id: c.id, tipo: "relato", descricao: texto, autor,
    } as never);
    setRelatoSubmitting(false);
    if (error) return toast.error(error.message);
    const autorNome = operatorsRef.current.find((o) => o.email === autor)?.name?.trim() || autor;
    void triggerPushForChamado({
      headers: await authHeaders(),
      data: { chamadoId: c.id, tipo: "relato", descricao: texto, autorNome },
    }).catch(() => {});
    toast.success("Relato adicionado");
    setRelatoModal(null);
  };

  const filtered = items.filter((c) => {
    // Refino client-side por nome do cliente (server-side já filtrou o resto)
    if (!searchDebounced.trim()) return true;
    const s = searchDebounced.toLowerCase();
    return (
      c.titulo.toLowerCase().includes(s) ||
      (c.clientes?.nome ?? "").toLowerCase().includes(s) ||
      String(c.numero).includes(searchDebounced)
    );
  });

  return (
    <AppShell title="Chamados">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="flex items-center gap-2 border border-border bg-card px-3 py-2 flex-1 max-w-md">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, cliente ou ID…"
              className="flex-1 bg-transparent text-sm focus:outline-none font-mono min-w-0" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border border-border px-2 md:px-3 py-2 text-xs md:text-sm font-mono">
            <option value="todos">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="aguardando_cliente">Aguardando cliente</option>
            <option value="resolvido">Resolvido</option>
          </select>
          <select value={prioridadeFilter} onChange={(e) => setPrioridadeFilter(e.target.value)}
            className="bg-card border border-border px-2 md:px-3 py-2 text-xs md:text-sm font-mono">
            <option value="todos">Todas prioridades</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <select value={responsavelFilter} onChange={(e) => setResponsavelFilter(e.target.value)}
            className="bg-card border border-border px-2 md:px-3 py-2 text-xs md:text-sm font-mono">
            <option value="todos">Todos responsáveis</option>
            <option value="meus">Meus chamados</option>
            <option value="nao_atribuidos">Não atribuídos</option>
            {operators.map((o) => <option key={o.id} value={o.id}>{o.email}</option>)}
          </select>
        </div>
        {canWrite && (
          <button onClick={() => { setForm(empty); setOpen(true); }}
            className="bg-primary text-primary-foreground px-3 md:px-4 py-2 text-xs md:text-sm font-semibold uppercase tracking-wider flex items-center gap-2 hover:opacity-90 shrink-0">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Chamado</span><span className="sm:hidden">Novo</span>
          </button>
        )}
      </div>

      <div className="hidden md:block border border-border bg-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
            <tr>
              <th className="p-4 font-medium font-mono">ID</th>
              <th className="p-4 font-medium font-mono">CLIENTE</th>
              <th className="p-4 font-medium font-mono">TÍTULO</th>
              <th className="p-4 font-medium font-mono">RESPONSÁVEL</th>
              <th className="p-4 font-medium font-mono">PRIORIDADE</th>
              <th className="p-4 font-medium font-mono">SLA</th>
              <th className="p-4 font-medium font-mono">STATUS</th>
              <th className="p-4 font-medium font-mono text-right">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground font-mono">Nenhum chamado encontrado.</td></tr>
            )}
            {filtered.map((c) => {
              const sla = slaMap ? calcSla(c, slaMap) : null;
              const finalizado = c.status === "resolvido" || c.status === "fechado";
              const meu = !!c.responsavel_id && c.responsavel_id === user?.id;
              return (
              <tr key={c.id} className={`hover:bg-secondary/30 cursor-pointer ${sla?.estourado ? "bg-red-500/5" : ""}`} onClick={() => setDetail(c)}>
                <td
                  className="p-4 font-mono text-muted-foreground hover:text-primary cursor-pointer group/copy transition-colors"
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const label = ticketLabel(c);
                    let ok = false;
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(label);
                        ok = true;
                      }
                    } catch {
                      ok = false;
                    }
                    if (!ok) {
                      try {
                        const ta = document.createElement("textarea");
                        ta.value = label;
                        ta.style.position = "fixed";
                        ta.style.opacity = "0";
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        ok = document.execCommand("copy");
                        ta.remove();
                      } catch {
                        ok = false;
                      }
                    }
                    if (ok) toast.success(`Protocolo ${label} copiado`);
                    else toast.error("Falha ao copiar");
                  }}
                  title="Clique para copiar"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {ticketLabel(c)}
                    <Copy className="h-3 w-3 opacity-0 group-hover/copy:opacity-70 transition-opacity" />
                  </span>
                </td>
                <td className="p-4 font-medium">{c.clientes?.nome ?? "—"}</td>
                <td className="p-4">{c.titulo}</td>
                <td className="p-4 font-mono text-xs">
                  {c.responsavel_id
                    ? <span className="inline-flex items-center gap-1"><UserCheck className="h-3 w-3 text-primary" />{opEmailById.get(c.responsavel_id) ?? c.tecnico_responsavel ?? "—"}</span>
                    : <span className="text-muted-foreground">não atribuído</span>}
                </td>
                <td className={`p-4 font-mono uppercase ${prioridadeColor(c.prioridade)}`}>{c.prioridade}</td>
                <td className="p-4 font-mono text-[10px]">
                  {!sla ? <span className="text-muted-foreground">…</span> : (
                    <div className="flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex-1 min-w-0">
                        {sla.pausado ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-slate-500/40 text-slate-300 bg-slate-500/10">
                            ⏸ PAUSADO
                          </span>
                        ) : !sla.ativo ? (
                          <span className={sla.cumprido ? "text-emerald-400" : "text-red-400"}>
                            {sla.cumprido ? "CUMPRIDO" : "ESTOURADO"}
                          </span>
                        ) : sla.estourado ? (
                          <span className="inline-flex items-center gap-1 text-red-400">
                            <AlertTriangle className="h-3 w-3" /> {formatHorasRestantes(sla.restante)} atrasado
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <div className={
                              sla.color === "red" ? "text-red-400" :
                              sla.color === "amber" ? "text-amber-400" : "text-emerald-400"
                            }>{formatHorasRestantes(sla.restante)} restantes</div>
                            <div className="h-1 w-full bg-secondary overflow-hidden">
                              <div className={
                                (sla.color === "red" ? "bg-red-400" : sla.color === "amber" ? "bg-amber-400" : "bg-emerald-400") + " h-full"
                              } style={{ width: `${Math.min(100, sla.pct)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                      {canWrite && sla.ativo && (
                        <button
                          title={sla.pausado ? "Retomar SLA" : "Pausar SLA · retorno do cliente"}
                          onClick={() => togglePausa(c)}
                          className={`shrink-0 p-1 border ${sla.pausado
                            ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                            : "border-slate-500/40 text-slate-300 hover:bg-slate-500/10"}`}
                        >
                          {sla.pausado ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 border font-mono uppercase ${statusBadge(c.status)}`}>
                    {c.status.replace("_", " ")}
                  </span>
                </td>
                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex gap-1">
                    {canWrite && !finalizado && !c.responsavel_id && (
                      <button title="Pegar pra mim" onClick={() => pegarParaMim(c)}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-primary"><Hand className="h-3.5 w-3.5" /></button>
                    )}
                    {canWrite && !finalizado && c.responsavel_id && (isAdmin || meu) && (
                      <button title="Liberar" onClick={() => liberar(c)}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-amber-400"><UserMinus className="h-3.5 w-3.5" /></button>
                    )}
                    {isAdmin && finalizado && (
                      <button title="Reabrir" onClick={() => reabrir(c)}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-emerald-400"><RotateCcw className="h-3.5 w-3.5" /></button>
                    )}
                    {canWrite && (
                      <button onClick={() => { setForm(c); setOpen(true); }}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                    )}
                    {canWrite && !finalizado && (
                      <button title="Adicionar relato" onClick={() => addRelatoRapido(c)}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-emerald-400"><MessageSquare className="h-3.5 w-3.5" /></button>
                    )}
                    {canWrite && !finalizado && (
                      <button title="Finalizar atendimento" onClick={() => openFinalizar(c)}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                    )}
                    {isAdmin && (
                      <button onClick={() => remove(c.id)}
                        className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: lista em cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="border border-border bg-card p-6 text-center text-muted-foreground font-mono text-xs">Nenhum chamado encontrado.</div>
        )}
        {filtered.map((c) => {
          const sla = slaMap ? calcSla(c, slaMap) : null;
          const finalizado = c.status === "resolvido" || c.status === "fechado";
          const meu = !!c.responsavel_id && c.responsavel_id === user?.id;
          return (
            <div key={c.id} onClick={() => setDetail(c)}
              className={`border border-border bg-card p-3 active:bg-secondary/40 ${sla?.estourado ? "bg-red-500/5" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <span>{ticketLabel(c)}</span>
                    <span className={`px-1.5 py-px border uppercase ${statusBadge(c.status)}`}>{c.status.replace("_", " ")}</span>
                    <span className={`uppercase ${prioridadeColor(c.prioridade)}`}>● {c.prioridade}</span>
                  </div>
                  <div className="text-sm font-medium mt-1 truncate">{c.titulo}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.clientes?.nome ?? "—"}</div>
                  <div className="text-[10px] font-mono mt-1">
                    {c.responsavel_id
                      ? <span className="text-primary">{(opEmailById.get(c.responsavel_id) ?? c.tecnico_responsavel ?? "—").split("@")[0]}</span>
                      : <span className="text-muted-foreground">não atribuído</span>}
                    {sla?.ativo && <span className={`ml-2 ${
                      sla.pausado ? "text-slate-300" :
                      sla.color === "red" ? "text-red-400" : sla.color === "amber" ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      · {sla.pausado ? "⏸ pausado" : sla.estourado ? `${formatHorasRestantes(sla.restante)} atrasado` : formatHorasRestantes(sla.restante)}
                    </span>}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                {canWrite && !finalizado && !c.responsavel_id && (
                  <button title="Pegar pra mim" onClick={() => pegarParaMim(c)} className="p-1.5 border border-border hover:bg-secondary text-muted-foreground hover:text-primary"><Hand className="h-3.5 w-3.5" /></button>
                )}
                {canWrite && !finalizado && c.responsavel_id && (isAdmin || meu) && (
                  <button title="Liberar" onClick={() => liberar(c)} className="p-1.5 border border-border hover:bg-secondary text-muted-foreground hover:text-amber-400"><UserMinus className="h-3.5 w-3.5" /></button>
                )}
                {isAdmin && finalizado && (
                  <button title="Reabrir" onClick={() => reabrir(c)} className="p-1.5 border border-border hover:bg-secondary text-muted-foreground hover:text-emerald-400"><RotateCcw className="h-3.5 w-3.5" /></button>
                )}
                {canWrite && (
                  <button onClick={() => { setForm(c); setOpen(true); }} className="p-1.5 border border-border hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                )}
                {canWrite && !finalizado && (
                  <button title="Adicionar relato" onClick={() => addRelatoRapido(c)} className="p-1.5 border border-border hover:bg-secondary text-muted-foreground hover:text-emerald-400"><MessageSquare className="h-3.5 w-3.5" /></button>
                )}
                {canWrite && !finalizado && (
                  <button title="Finalizar atendimento" onClick={() => openFinalizar(c)} className="p-1.5 border border-border hover:bg-secondary text-muted-foreground hover:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                )}
                {isAdmin && (
                  <button onClick={() => remove(c.id)} className="p-1.5 border border-border hover:bg-secondary text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4 text-xs font-mono text-muted-foreground">
        <div>
          {total > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total}` : "0 resultados"}
        </div>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1 border border-border bg-card disabled:opacity-30 hover:bg-secondary inline-flex items-center gap-1">
            <ChevronLeft className="h-3 w-3" /> Anterior
          </button>
          <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border border-border bg-card disabled:opacity-30 hover:bg-secondary inline-flex items-center gap-1">
            Próxima <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={save} className="bg-card border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="font-display text-lg font-bold">{form.id ? "Editar Chamado" : "Novo Chamado"}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Lbl>Título *</Lbl>
                <input required value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div>
                <Lbl>Cliente</Lbl>
                <select value={form.cliente_id ?? ""} onChange={(e) => setForm({ ...form, cliente_id: e.target.value || null })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary">
                  <option value="">— Sem cliente —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Categoria</Lbl>
                <input value={form.categoria ?? ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Ex: Conexão, Financeiro, Instalação"
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono" />
              </div>
              <div>
                <Lbl>Tipo de problema</Lbl>
                <select
                  value={form.tipo_problema ?? ""}
                  onChange={(e) => setForm({ ...form, tipo_problema: e.target.value || null })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                >
                  <option value="">— Selecionar —</option>
                  {TIPOS_PROBLEMA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Prioridade</Lbl>
                <select value={form.prioridade ?? "media"} onChange={(e) => setForm({ ...form, prioridade: e.target.value as Prioridade })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary">
                  <option value="baixa">Baixa</option><option value="media">Média</option>
                  <option value="alta">Alta</option><option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <Lbl>Status</Lbl>
                <select value={form.status ?? "aberto"} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary">
                  <option value="aberto">Aberto</option>
                  <option value="aguardando_cliente">Aguardando cliente</option>
                  <option value="resolvido">Resolvido</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <Lbl>Responsável (operador)</Lbl>
                <select
                  value={form.responsavel_id ?? ""}
                  onChange={(e) => setForm({ ...form, responsavel_id: e.target.value || null })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                >
                  <option value="">— Não atribuído —</option>
                  {operators.map((o) => (
                    <option key={o.id} value={o.id}>{o.email} ({o.role})</option>
                  ))}
                </select>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  Apenas administradores e operadores aparecem na lista.
                </p>
              </div>
              <div className="md:col-span-2">
                <Lbl>Descrição</Lbl>
                <textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={4}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div>
                <Lbl>Horário inicial</Lbl>
                <input
                  type="datetime-local"
                  value={isoToLocalInput(form.iniciado_at as string | null | undefined)}
                  onChange={(e) => setForm({ ...form, iniciado_at: localInputToIso(e.target.value) })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <Lbl>Horário final</Lbl>
                <input
                  type="datetime-local"
                  value={isoToLocalInput(form.finalizado_at as string | null | undefined)}
                  onChange={(e) => setForm({ ...form, finalizado_at: localInputToIso(e.target.value) })}
                  className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div className="md:col-span-2">
                <Lbl>Anexos</Lbl>
                <label className="mt-1 block border border-dashed border-border bg-background hover:bg-secondary/30 cursor-pointer p-4 text-center text-xs text-muted-foreground font-mono">
                  <Paperclip className="h-4 w-4 inline mr-2" />
                  Clique para selecionar arquivos
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {pendingFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {pendingFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs font-mono bg-background border border-border px-2 py-1">
                        <span className="truncate">{f.name} <span className="text-muted-foreground">({Math.round(f.size / 1024)} KB)</span></span>
                        <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive ml-2">
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-2">
              <button type="button" onClick={() => { setOpen(false); setPendingFiles([]); }} className="px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground">Cancelar</button>
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:opacity-90">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {detail && <DetailDrawer chamado={detail} operators={operators} canWrite={canWrite} onClose={() => { setDetail(null); load(); }} autor={user?.email ?? "operador"} />}

      <Dialog open={!!relatoModal} onOpenChange={(o) => { if (!o && !relatoSubmitting) setRelatoModal(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono uppercase tracking-wider text-sm">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              Novo relato
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {relatoModal ? `Chamado ${ticketLabel(relatoModal.chamado)} · ${relatoModal.chamado.titulo}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              autoFocus
              value={relatoModal?.texto ?? ""}
              onChange={(e) => setRelatoModal((m) => (m ? { ...m, texto: e.target.value } : m))}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void submitRelato(); }
              }}
              placeholder="Descreva o andamento, ação executada ou observação…"
              maxLength={2000}
              rows={6}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>Ctrl+Enter para enviar</span>
              <span>{(relatoModal?.texto ?? "").length}/2000</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setRelatoModal(null)}
              disabled={relatoSubmitting}
              className="px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submitRelato()}
              disabled={relatoSubmitting || (relatoModal?.texto.trim().length ?? 0) < 3}
              className="bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {relatoSubmitting ? "Enviando…" : "Adicionar relato"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!finalizarModal} onOpenChange={(o) => { if (!o && !finalizarSubmitting) setFinalizarModal(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono uppercase tracking-wider text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Finalizar atendimento
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {finalizarModal ? `Chamado ${ticketLabel(finalizarModal.chamado)} · ${finalizarModal.chamado.titulo}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              autoFocus
              value={finalizarModal?.texto ?? ""}
              onChange={(e) => setFinalizarModal((m) => (m ? { ...m, texto: e.target.value } : m))}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void submitFinalizar(); }
              }}
              placeholder="Relato de encerramento (opcional): solução aplicada, validações realizadas…"
              maxLength={2000}
              rows={6}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>Ctrl+Enter para finalizar</span>
              <span>{(finalizarModal?.texto ?? "").length}/2000</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setFinalizarModal(null)}
              disabled={finalizarSubmitting}
              className="px-4 py-2 text-sm font-mono text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submitFinalizar()}
              disabled={finalizarSubmitting}
              className="bg-emerald-500 text-white px-4 py-2 text-sm font-semibold uppercase tracking-wider hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {finalizarSubmitting ? "Finalizando…" : "Finalizar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{children}</label>;
}

function DetailDrawer({ chamado, onClose, autor, operators, canWrite }: { chamado: Chamado; onClose: () => void; autor: string; operators: Operator[]; canWrite: boolean }) {
  const { user } = useAuth();
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [historicoPage, setHistoricoPage] = useState(0);
  const [historicoHasMore, setHistoricoHasMore] = useState(true);
  const [historicoLoadingMore, setHistoricoLoadingMore] = useState(false);
  const HISTORICO_PAGE_SIZE = 20;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [comentario, setComentario] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<Status>(chamado.status);
  const [prioridade, setPrioridade] = useState<Prioridade>(chamado.prioridade);
  const [responsavelId, setResponsavelId] = useState<string>(chamado.responsavel_id ?? "");
  const [savingQuick, setSavingQuick] = useState(false);
  const [slaMap, setSlaMap] = useState<SlaMap | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [finalizadoAtOverride, setFinalizadoAtOverride] = useState<string>("");

  useEffect(() => { getSlaMap().then(setSlaMap); }, []);
  const authorName =
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name?.trim() ||
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name?.trim() ||
    operators.find((o) => o.email === autor)?.name?.trim() ||
    autor;
  // Atualiza contador de SLA a cada 30s
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setStatus(chamado.status);
    setPrioridade(chamado.prioridade);
    setResponsavelId(chamado.responsavel_id ?? "");
    setFinalizadoAtOverride("");
  }, [chamado.id, chamado.status, chamado.prioridade, chamado.responsavel_id]);

  const dirty = status !== chamado.status || prioridade !== chamado.prioridade || (responsavelId || null) !== (chamado.responsavel_id || null);

  const saveQuick = async () => {
    if (!canWrite) return toast.error("Sem permissão.");
    setSavingQuick(true);
    const finalizando = status === "resolvido" || status === "fechado";
    // Quem finaliza vira o responsável automaticamente
    const effectiveRespId = finalizando && user?.id ? user.id : (responsavelId || null);
    const opEmail = operators.find((o) => o.id === effectiveRespId)?.email ?? null;
    const effectiveTecnico = finalizando
      ? (opEmail ?? user?.email ?? null)
      : (responsavelId ? opEmail : null);
    const payload: Record<string, unknown> = {
      status, prioridade,
      responsavel_id: effectiveRespId,
      tecnico_responsavel: effectiveTecnico,
    };
    const overrideIso = finalizadoAtOverride ? localInputToIso(finalizadoAtOverride) : null;
    const finalizadoIso = overrideIso ?? new Date().toISOString();
    if (status === "resolvido" && (!chamado.resolvido_at || overrideIso)) payload.resolvido_at = finalizadoIso;
    if (status !== "resolvido" && status !== "fechado") payload.resolvido_at = null;
    if (status === "aberto" && !chamado.iniciado_at) payload.iniciado_at = new Date().toISOString();
    if (status === "resolvido" && (!chamado.finalizado_at || overrideIso)) payload.finalizado_at = finalizadoIso;
    // Se houver texto no relato, grava junto (ideal no fechamento)
    if (comentario.trim()) {
      await supabase.from("chamado_historico").insert({
        chamado_id: chamado.id, tipo: "relato", descricao: comentario.trim(), autor,
      } as never);
      void triggerPushForChamado({
        headers: await authHeaders(),
        data: { chamadoId: chamado.id, tipo: "relato", descricao: comentario.trim(), autorNome: authorName },
      }).catch(() => {});
      setComentario("");
    }
    const { error } = await supabase.from("chamados").update(payload as never).eq("id", chamado.id);
    setSavingQuick(false);
    if (error) return toast.error(error.message);
    if (status !== chamado.status) {
      void triggerPushForChamado({
        headers: await authHeaders(),
        data: {
          chamadoId: chamado.id,
          tipo: finalizando ? "finalizacao" : "status",
          descricao: `Status alterado de ${chamado.status} para ${status}`,
          autorNome: authorName,
        },
      }).catch(() => {});
    }
    toast.success(finalizando ? "Chamado finalizado" : "Chamado atualizado");
    Object.assign(chamado, payload);
    if (finalizando && effectiveRespId) setResponsavelId(effectiveRespId);
    if (finalizando) {
      onClose();
      return;
    }
    load();
  };

  const load = async () => {
    const [h, a] = await Promise.all([
      supabase
        .from("chamado_historico")
        .select("*")
        .eq("chamado_id", chamado.id)
        .order("created_at", { ascending: false })
        .range(0, HISTORICO_PAGE_SIZE - 1),
      supabase.from("chamado_anexos").select("*").eq("chamado_id", chamado.id).order("created_at", { ascending: false }),
    ]);
    const rows = (h.data as Historico[]) ?? [];
    setHistorico(rows);
    setHistoricoPage(0);
    setHistoricoHasMore(rows.length === HISTORICO_PAGE_SIZE);
    setAnexos((a.data as Anexo[]) ?? []);
  };
  useEffect(() => { load(); }, [chamado.id]);

  // Realtime: novos relatos/eventos do chamado aberto
  useEffect(() => {
    const channel = supabase
      .channel(`chamado-historico-${chamado.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chamado_historico", filter: `chamado_id=eq.${chamado.id}` },
        (payload) => {
          const h = payload.new as Historico;
          setHistorico((prev) => (prev.some((p) => p.id === h.id) ? prev : [h, ...prev]));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chamado.id]);

  const loadMoreHistorico = async () => {
    if (historicoLoadingMore || !historicoHasMore) return;
    setHistoricoLoadingMore(true);
    const nextPage = historicoPage + 1;
    const from = nextPage * HISTORICO_PAGE_SIZE;
    const to = from + HISTORICO_PAGE_SIZE - 1;
    const { data } = await supabase
      .from("chamado_historico")
      .select("*")
      .eq("chamado_id", chamado.id)
      .order("created_at", { ascending: false })
      .range(from, to);
    const rows = (data as Historico[]) ?? [];
    setHistorico((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...rows.filter((r) => !seen.has(r.id))];
    });
    setHistoricoPage(nextPage);
    setHistoricoHasMore(rows.length === HISTORICO_PAGE_SIZE);
    setHistoricoLoadingMore(false);
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreHistorico();
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historicoPage, historicoHasMore, historicoLoadingMore, chamado.id]);

  const sla = slaMap ? calcSla({ ...chamado, prioridade }, slaMap) : null;
  void nowTick; // força re-render no tick

  const addComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comentario.trim()) return;
    const { error } = await supabase.from("chamado_historico").insert({
      chamado_id: chamado.id, tipo: "relato", descricao: comentario.trim(), autor,
    } as never);
    if (error) return toast.error(error.message);
    void triggerPushForChamado({
      headers: await authHeaders(),
      data: { chamadoId: chamado.id, tipo: "relato", descricao: comentario.trim(), autorNome: authorName },
    }).catch(() => {});
    setComentario(""); load();
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${chamado.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("chamado-anexos").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("chamado_anexos").insert({
        chamado_id: chamado.id, nome_arquivo: file.name, storage_path: path,
        mime_type: file.type, tamanho: file.size,
      } as never);
      if (error) throw error;
      await supabase.from("chamado_historico").insert({
        chamado_id: chamado.id, tipo: "anexo", descricao: `Anexo enviado: ${file.name}`, autor,
      } as never);
      toast.success("Anexo enviado");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally { setUploading(false); }
  };

  const downloadAnexo = async (a: Anexo) => {
    const { data, error } = await supabase.storage.from("chamado-anexos").createSignedUrl(a.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const removeAnexo = async (a: Anexo) => {
    if (!confirm("Excluir anexo?")) return;
    await supabase.storage.from("chamado-anexos").remove([a.storage_path]);
    await supabase.from("chamado_anexos").delete().eq("id", a.id);
    toast.success("Anexo removido"); load();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex" onClick={onClose}>
      <div ref={scrollRef} className="bg-card w-full h-full overflow-y-auto overflow-x-hidden overscroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="relative border-b border-border sticky top-0 z-10 bg-gradient-to-br from-primary/10 via-card to-card">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,theme(colors.primary/15),transparent_60%)] pointer-events-none" />
          <div className="relative px-3 sm:px-5 py-3 flex justify-between items-start gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase">
                <Hash className="h-3 w-3" />
                <span>{ticketLabel(chamado)}</span>
              </div>
              <h2 className="font-display text-lg font-bold mt-1 leading-tight break-words">{chamado.titulo}</h2>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`px-2.5 py-1 border text-[10px] font-mono uppercase tracking-wider ${statusBadge(chamado.status)}`}>{chamado.status.replace("_", " ")}</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 border border-border bg-background/40 text-[10px] font-mono uppercase tracking-wider ${prioridadeColor(chamado.prioridade)}`}>● {chamado.prioridade}</span>
                {chamado.clientes?.nome && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 border border-border bg-background/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <Building2 className="h-3 w-3" /> {chamado.clientes.nome}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="shrink-0 inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold shadow-lg hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive transition"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">FECHAR</span>
            </button>
          </div>
        </div>

        <div className="px-3 sm:px-5 py-4 space-y-3 pb-8">
          {canWrite && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-2 border border-border bg-background/60 rounded-md p-3 shadow-sm">
              <div>
                <Lbl>Status</Lbl>
                <select value={status} onChange={(e) => setStatus(e.target.value as Status)}
                  className="mt-1 w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary transition">
                  <option value="aberto">Aberto</option>
                  <option value="aguardando_cliente">Aguardando cliente</option>
                  <option value="resolvido">Resolvido</option>
                </select>
              </div>
              <div>
                <Lbl>Prioridade</Lbl>
                <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}
                  className="mt-1 w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary transition">
                  <option value="baixa">Baixa</option><option value="media">Média</option>
                  <option value="alta">Alta</option><option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <Lbl>Responsável</Lbl>
                <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}
                  className="mt-1 w-full bg-card border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary transition">
                  <option value="">— Não atribuído —</option>
                  {operators.map((o) => <option key={o.id} value={o.id}>{o.email}</option>)}
                </select>
              </div>
              {dirty && (status === "resolvido" || status === "fechado") && (
                <div className="md:col-span-3 flex items-start gap-2 text-[10px] font-mono text-emerald-300 bg-emerald-500/5 border border-emerald-500/20 rounded px-2.5 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-px shrink-0" />
                  <span>Ao finalizar, você será definido como responsável e o relato abaixo (se houver) será registrado.</span>
                </div>
              )}
            </section>
          )}

          <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            <Info icon={Building2} label="Cliente" value={chamado.clientes?.nome ?? "—"} />
            <Info icon={Tag} label="Categoria" value={chamado.categoria ?? "—"} />
            <Info icon={AlertCircle} label="Tipo de problema" value={chamado.tipo_problema ?? "—"} />
            <Info icon={User} label="Responsável" value={chamado.tecnico_responsavel ?? (chamado.responsavel_id ? "atribuído" : "não atribuído")} />
            <Info icon={CalendarClock} label="Aberto em" value={new Date(chamado.created_at).toLocaleString("pt-BR")} />
            <Info icon={PlayCircle} label="Horário inicial" value={chamado.iniciado_at ? new Date(chamado.iniciado_at).toLocaleString("pt-BR") : "—"} />
            {canWrite && status === "resolvido" && !chamado.finalizado_at ? (
              <div className="group flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 transition">
                <div className="mt-0.5 shrink-0 rounded p-1 bg-primary/20 text-primary">
                  <StopCircle className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground leading-tight">
                    Horário final {finalizadoAtOverride ? "" : "(auto ao finalizar)"}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      type="datetime-local"
                      value={finalizadoAtOverride}
                      onChange={(e) => setFinalizadoAtOverride(e.target.value)}
                      className="flex-1 min-w-0 bg-card border border-border rounded px-1.5 py-1 text-[11px] font-mono focus:outline-none focus:border-primary transition"
                    />
                    {finalizadoAtOverride && (
                      <button
                        type="button"
                        title="Usar data/hora atual ao finalizar"
                        onClick={() => setFinalizadoAtOverride("")}
                        className="shrink-0 text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-1 border border-border rounded"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Info icon={StopCircle} label="Horário final" value={chamado.finalizado_at ? new Date(chamado.finalizado_at).toLocaleString("pt-BR") : "—"} />
            )}
            <Info icon={Timer} label="Duração do atendimento" value={formatDuracao(chamado.iniciado_at ?? chamado.created_at, chamado.finalizado_at, { emAndamento: true })} highlight />
            {chamado.finalizado_at && (
              <Info
                icon={CheckCircle2}
                label="Finalizado por"
                value={(() => {
                  const op = chamado.responsavel_id ? operators.find((o) => o.id === chamado.responsavel_id) : undefined;
                  return op?.name || op?.email || chamado.tecnico_responsavel || "—";
                })()}
              />
            )}
          </section>

          {sla && (
            <section className={`border rounded-md p-3 shadow-sm ${
              sla.pausado ? "border-slate-500/30 bg-slate-500/5" :
              sla.color === "red" ? "border-red-500/30 bg-red-500/5" :
              sla.color === "amber" ? "border-amber-500/30 bg-amber-500/5" :
              "border-emerald-500/30 bg-emerald-500/5"
            }`}>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2 gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="h-3 w-3" /> SLA · Prazo {sla.limite}h ({prioridade})
                </span>
                <div className="flex items-center gap-2">
                  <span className={"font-bold " +(
                    sla.pausado ? "text-slate-300" :
                    sla.color === "red" ? "text-red-400" : sla.color === "amber" ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {sla.pausado
                      ? "⏸ PAUSADO (aguardando cliente)"
                      : !sla.ativo
                      ? (sla.cumprido ? "CUMPRIDO" : "ESTOURADO")
                      : sla.estourado
                        ? `Estourou há ${formatHorasRestantes(sla.restante)}`
                        : `Vence em ${formatHorasRestantes(sla.restante)}`}
                  </span>
                  {canWrite && sla.ativo && (
                    <button
                      type="button"
                      title={sla.pausado ? "Retomar SLA" : "Pausar SLA · retorno do cliente"}
                      onClick={async () => {
                        const novo = sla.pausado ? "aberto" : "aguardando_cliente";
                        const { error } = await supabase.from("chamados")
                          .update({ status: novo } as never).eq("id", chamado.id);
                        if (error) return toast.error(error.message);
                        setStatus(novo as Status);
                        toast.success(novo === "aguardando_cliente" ? "SLA pausado · aguardando cliente" : "SLA retomado");
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] uppercase tracking-widest transition ${sla.pausado
                        ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                        : "border-slate-500/40 text-slate-300 hover:bg-slate-500/10"}`}
                    >
                      {sla.pausado ? <><Play className="h-3 w-3" /> Retomar</> : <><Pause className="h-3 w-3" /> Pausar</>}
                    </button>
                  )}
                </div>
              </div>
              <div className="h-2 w-full bg-secondary/70 rounded-full overflow-hidden">
                <div className={
                  (sla.pausado ? "bg-gradient-to-r from-slate-500 to-slate-400" :
                   sla.color === "red" ? "bg-gradient-to-r from-red-500 to-red-400" :
                   sla.color === "amber" ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                   "bg-gradient-to-r from-emerald-500 to-emerald-400") + " h-full transition-all rounded-full"
                } style={{ width: `${Math.min(100, sla.pct)}%` }} />
              </div>
              <div className="mt-1.5 text-[10px] font-mono text-muted-foreground">
                {sla.decorrido.toFixed(1)}h decorridas de {sla.limite}h ({sla.pct.toFixed(0)}%)
                {sla.pausado && " · cronômetro pausado"}
              </div>
            </section>
          )}

          {chamado.descricao && (
            <section className="border border-border bg-background/60 rounded-md p-3">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-2">
                <FileText className="h-3 w-3" /> Descrição
              </h3>
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{chamado.descricao}</p>
            </section>
          )}

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Paperclip className="h-3 w-3" /> Anexos <span className="text-foreground/70">({anexos.length})</span>
            </h3>
            <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border bg-background/40 hover:bg-secondary/30 hover:border-primary/50 cursor-pointer p-5 rounded-md text-center text-xs text-muted-foreground font-mono mb-3 transition">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span>{uploading ? "Enviando…" : "Clique para enviar arquivo"}</span>
              <input type="file" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            </label>
            <div className="space-y-2">
              {anexos.map((a) => (
                <div key={a.id} className="group flex items-center justify-between border border-border bg-background/60 hover:bg-secondary/30 rounded px-3 py-2 text-xs transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded bg-primary/10 text-primary shrink-0">
                      <Paperclip className="h-3 w-3" />
                    </div>
                    <span className="truncate font-medium">{a.nome_arquivo}</span>
                    {a.tamanho && <span className="text-muted-foreground font-mono shrink-0">({(a.tamanho / 1024).toFixed(0)}KB)</span>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => downloadAnexo(a)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition"><Download className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeAnexo(a)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <History className="h-3 w-3" /> Relatos / Andamento & Histórico
            </h3>
            <form onSubmit={addComentario} className="mb-4 space-y-2">
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3}
                placeholder={status === "resolvido" || status === "fechado"
                  ? "Descreva a resolução / observações finais…"
                  : "Adicionar relato sobre o andamento do chamado…"}
                className="w-full bg-background/60 border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:bg-background transition" />
              <div className="flex justify-end gap-2 flex-wrap">
                <button type="submit" disabled={!comentario.trim()}
                  className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded text-foreground px-3 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-40 hover:bg-secondary/70 transition">
                  <MessageSquare className="h-3.5 w-3.5" /> Adicionar relato
                </button>
                {canWrite && dirty && (
                  <button type="button" disabled={savingQuick} onClick={saveQuick}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-50 shadow-sm transition ${
                      status === "resolvido" || status === "fechado"
                        ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                    }`}>
                    {savingQuick
                      ? "Salvando…"
                      : status === "resolvido" || status === "fechado"
                        ? <><CheckCircle2 className="h-3.5 w-3.5" /> Finalizar</>
                        : "Aplicar"}
                  </button>
                )}
              </div>
            </form>
            <div className="space-y-3">
              {historico.length === 0 && <div className="text-xs text-muted-foreground font-mono">Sem registros.</div>}
              {historico.map((h) => {
                const isFinal = h.tipo === "mudanca_status" && (h.status_novo === "resolvido" || h.status_novo === "fechado");
                const tone = isFinal ? "border-emerald-400" :
                  h.tipo === "criacao" ? "border-primary/60" :
                  h.tipo === "mudanca_status" ? "border-amber-500/60" :
                  h.tipo === "mudanca_prioridade" ? "border-orange-500/60" :
                  h.tipo === "mudanca_responsavel" ? "border-violet-500/60" :
                  h.tipo === "anexo" ? "border-cyan-500/60" :
                  h.tipo === "relato" ? "border-emerald-500/60" :
                  "border-border";
                const autorOp = h.autor ? operators.find((o) => o.email === h.autor) : undefined;
                const autorLabel = autorOp?.name || h.autor || "sistema";
                return (
                  <div
                    key={h.id}
                    className={`border-l-2 pl-3 pb-2 ${tone} ${isFinal ? "bg-emerald-500/5 rounded-r" : ""}`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-muted-foreground flex-wrap">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      <span className={`px-1.5 py-px border ${isFinal ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300" : "border-border bg-background"}`}>
                        {isFinal ? `Finalizado (${h.status_novo})` : h.tipo.replace("_", " ")}
                      </span>
                      <span>· {autorLabel}</span>
                    </div>
                    <div className={`text-sm mt-1 ${isFinal ? "text-emerald-200 font-medium" : ""}`}>{h.descricao}</div>
                  </div>
                );
              })}
              {historicoHasMore && (
                <div ref={sentinelRef} className="text-center text-[10px] font-mono text-muted-foreground py-2">
                  {historicoLoadingMore ? "Carregando…" : ""}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className={`group flex items-start gap-2 rounded-md border px-2.5 py-1.5 transition hover:border-primary/40 ${
      highlight
        ? "border-primary/30 bg-primary/5"
        : "border-border bg-background/50"
    }`}>
      {Icon && (
        <div className={`mt-0.5 shrink-0 rounded p-1 ${
          highlight ? "bg-primary/20 text-primary" : "bg-secondary/60 text-muted-foreground group-hover:text-primary"
        } transition`}>
          <Icon className="h-3 w-3" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground leading-tight">{label}</div>
        <div className={`text-xs mt-0.5 break-words leading-tight ${highlight ? "font-semibold text-foreground" : ""}`}>{value}</div>
      </div>
    </div>
  );
}
