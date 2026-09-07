import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { requireAuth } from "@/lib/guard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Bell, BellOff, ArrowLeft, Loader2, CheckCircle2, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  getMyPreferences,
  updateMyPreferences,
  savePushSubscription,
  removePushSubscription,
} from "@/lib/notifications.functions";
import {
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentPushEndpoint,
} from "@/lib/push-client";

export const Route = createFileRoute("/notificacoes/preferencias")({
  beforeLoad: requireAuth,
  component: PreferenciasPage,
});

type Prefs = {
  notify_finalizacao: boolean;
  notify_relato: boolean;
  notify_status: boolean;
  push_enabled: boolean;
};

function PreferenciasPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPush, setBusyPush] = useState(false);
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    setSupported(pushSupported());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    getMyPreferences()
      .then((p) => setPrefs(p as Prefs))
      .finally(() => setLoading(false));
  }, []);

  const update = async (patch: Partial<Prefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      await updateMyPreferences({ data: patch });
    } catch (e) {
      toast.error("Falha ao salvar preferência");
      setPrefs(prefs);
    }
  };

  const togglePush = async (enabled: boolean) => {
    if (!supported) {
      toast.error("Seu navegador não suporta notificações push");
      return;
    }
    setBusyPush(true);
    try {
      if (enabled) {
        const sub = await subscribeToPush();
        await savePushSubscription({ data: sub });
        await update({ push_enabled: true });
        setPermission("granted");
        toast.success("Notificações no navegador habilitadas");
      } else {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) await removePushSubscription({ data: { endpoint } });
        await update({ push_enabled: false });
        toast.message("Notificações no navegador desabilitadas");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao alterar push";
      toast.error(msg);
    } finally {
      setBusyPush(false);
    }
  };

  return (
    <AppShell title="Preferências de Notificação">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/notificacoes"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Central de notificações
          </Link>
        </div>

        {loading || !prefs ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <Card className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold flex items-center gap-2">
                    {prefs.push_enabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
                    Notificações no navegador (Web Push)
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Receba avisos mesmo com o app fechado. Funciona em desktop e Android.
                  </p>
                  {!supported && (
                    <p className="text-xs text-destructive mt-2">
                      Seu navegador atual não suporta Web Push.
                    </p>
                  )}
                  {supported && permission === "denied" && (
                    <p className="text-xs text-destructive mt-2">
                      Permissão bloqueada no navegador. Libere nas configurações do site.
                    </p>
                  )}
                </div>
                <Switch
                  checked={prefs.push_enabled}
                  disabled={busyPush || !supported}
                  onCheckedChange={togglePush}
                />
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-semibold">Quais eventos quero receber</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Aplica para toasts no app e para Web Push.
                </p>
              </div>

              <PrefRow
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                title="Finalização de chamado"
                desc="Quando alguém conclui um atendimento."
                checked={prefs.notify_finalizacao}
                onChange={(v) => update({ notify_finalizacao: v })}
              />
              <PrefRow
                icon={<MessageSquare className="h-4 w-4 text-primary" />}
                title="Novo relato"
                desc="Quando alguém adiciona um comentário/relato."
                checked={prefs.notify_relato}
                onChange={(v) => update({ notify_relato: v })}
              />
              <PrefRow
                icon={<RefreshCw className="h-4 w-4 text-amber-400" />}
                title="Mudança de status"
                desc="Quando o status do chamado muda (aberto, em andamento, resolvido…)."
                checked={prefs.notify_status}
                onChange={(v) => update({ notify_status: v })}
              />
            </Card>

            <div className="text-xs text-muted-foreground">
              Dica: você precisa habilitar pelo menos um evento e o push acima para receber alertas
              com o app fechado.
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function PrefRow({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-t border-border first:border-t-0">
      <div className="flex items-start gap-3">
        <div className="mt-1">{icon}</div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}