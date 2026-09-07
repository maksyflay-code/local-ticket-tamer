import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { requireAuth } from "@/lib/guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Bell,
  Settings2,
  CheckCheck,
  Loader2,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
  Circle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { HistRow, NotificationItem } from "@/lib/notifications.types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/notificacoes")({
  beforeLoad: requireAuth,
  component: NotificacoesPage,
});

const PAGE_SIZE = 20;

function NotificacoesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(
    async (p: number, replace: boolean) => {
      setLoading(true);
      try {
        if (!user) return;
        const res = await loadNotificationsPage(user.id, p, PAGE_SIZE, onlyUnread);
        setTotal(res.total);
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setPage(p);
      } catch (e) {
        console.error("[notificacoes] load error", e);
        toast.error("Falha ao carregar notificações");
      } finally {
        setLoading(false);
      }
    },
    [onlyUnread, user],
  );

  useEffect(() => {
    load(0, true);
  }, [load]);

  // Realtime: novos eventos atualizam a lista
  useEffect(() => {
    const channel = supabase
      .channel("notif-center")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chamado_historico" },
        () => load(0, true),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const onMarkOne = async (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, read: true } : it)));
    try {
      if (!user) return;
      const { error } = await supabase
        .from("notification_reads")
        .upsert({ user_id: user.id, historico_id: id }, { onConflict: "user_id,historico_id" });
      if (error) throw error;
    } catch {
      toast.error("Falha ao marcar como lida");
    }
  };

  const onMarkAll = async () => {
    try {
      if (!user) return;
      const ids = items.filter((it) => !it.read).map((it) => it.id);
      if (ids.length) {
        const { error } = await supabase
          .from("notification_reads")
          .upsert(
            ids.map((id) => ({ user_id: user.id, historico_id: id })),
            { onConflict: "user_id,historico_id" },
          );
        if (error) throw error;
      }
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
      toast.success("Tudo marcado como lido");
    } catch {
      toast.error("Falha ao marcar todas");
    }
  };

  const openChamado = async (id: string) => {
    if (typeof window !== "undefined") sessionStorage.setItem("chamados:open-id", id);
    navigate({ to: "/chamados" });
  };

  const hasMore = items.length < total;

  return (
    <AppShell title="Central de Notificações">
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Tudo que aconteceu</h2>
            <span className="text-xs text-muted-foreground">({total})</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={onlyUnread ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyUnread((v) => !v)}
            >
              {onlyUnread ? "Mostrando: não lidas" : "Mostrando: todas"}
            </Button>
            <Button variant="outline" size="sm" onClick={onMarkAll}>
              <CheckCheck className="h-4 w-4 mr-1" /> Marcar todas como lidas
            </Button>
            <Link to="/notificacoes/preferencias">
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-1" /> Preferências
              </Button>
            </Link>
          </div>
        </div>

        <Card className="divide-y divide-border">
          {items.length === 0 && !loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nada por aqui ainda.
            </div>
          ) : (
            items.map((it) => (
              <NotifRow
                key={it.id}
                item={it}
                onClick={() => {
                  if (!it.read) onMarkOne(it.id);
                  openChamado(it.chamado_id);
                }}
                onMark={() => onMarkOne(it.id)}
              />
            ))
          )}
        </Card>

        <div className="flex justify-center">
          {hasMore ? (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => load(page + 1, false)}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Carregar mais
            </Button>
          ) : (
            items.length > 0 && (
              <span className="text-xs text-muted-foreground">Fim da lista</span>
            )
          )}
        </div>
      </div>
    </AppShell>
  );
}

async function loadNotificationsPage(userId: string, page: number, pageSize: number, onlyUnread: boolean) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data: hist, count, error } = await supabase
    .from("chamado_historico")
    .select("id, chamado_id, tipo, descricao, autor, status_anterior, status_novo, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const rows = (hist ?? []) as HistRow[];
  const ids = rows.map((r) => r.id);
  const chamadoIds = Array.from(new Set(rows.map((r) => r.chamado_id)));

  const [readsRes, chamadosRes] = await Promise.all([
    ids.length
      ? supabase.from("notification_reads").select("historico_id").eq("user_id", userId).in("historico_id", ids)
      : Promise.resolve({ data: [] as { historico_id: string }[] }),
    chamadoIds.length
      ? supabase.from("chamados").select("id, codigo, numero, titulo").in("id", chamadoIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string | null; numero: number; titulo: string }[] }),
  ]);

  const readSet = new Set((readsRes.data ?? []).map((r) => r.historico_id));
  const chamadoMap = new Map(
    ((chamadosRes.data ?? []) as { id: string; codigo: string | null; numero: number; titulo: string }[]).map((c) => [c.id, c]),
  );

  const items = rows
    .filter((r) => (onlyUnread ? !readSet.has(r.id) : true))
    .map((r): NotificationItem => {
      const chamado = chamadoMap.get(r.chamado_id);
      return {
        ...r,
        read: readSet.has(r.id),
        chamado_codigo: chamado?.codigo ?? null,
        chamado_numero: chamado?.numero ?? null,
        chamado_titulo: chamado?.titulo ?? null,
      };
    });

  return { items, total: count ?? 0, page, pageSize };
}

function iconFor(tipo: string) {
  if (tipo === "mudanca_status") return <RefreshCw className="h-4 w-4 text-amber-400" />;
  if (tipo === "comentario" || tipo === "relato")
    return <MessageSquare className="h-4 w-4 text-primary" />;
  if (tipo === "criacao") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  return <Bell className="h-4 w-4 text-muted-foreground" />;
}

function NotifRow({
  item,
  onClick,
  onMark,
}: {
  item: NotificationItem;
  onClick: () => void;
  onMark: () => void;
}) {
  const label =
    item.chamado_codigo ??
    (item.chamado_numero ? `#TK-${String(item.chamado_numero).padStart(4, "0")}` : "Chamado");
  const when = new Date(item.created_at).toLocaleString("pt-BR");
  return (
    <div
      className={`flex gap-3 p-4 hover:bg-accent/40 cursor-pointer transition-colors ${
        item.read ? "opacity-70" : ""
      }`}
      onClick={onClick}
    >
      <div className="pt-1">{iconFor(item.tipo)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{label}</span>
          {item.chamado_titulo && <span className="truncate">— {item.chamado_titulo}</span>}
          <span className="ml-auto whitespace-nowrap">{when}</span>
        </div>
        <div className="text-sm mt-0.5">{item.descricao}</div>
        <div className="text-xs text-muted-foreground mt-1">
          por {item.autor ?? "sistema"}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {!item.read ? (
          <button
            className="text-xs text-primary hover:underline flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onMark();
            }}
          >
            <Circle className="h-2 w-2 fill-current" /> marcar como lida
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground">lida</span>
        )}
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
}