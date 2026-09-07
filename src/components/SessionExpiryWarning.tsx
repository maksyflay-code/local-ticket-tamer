import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const WARNING_MS = 5 * 60 * 1000; // 5 minutes

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SessionExpiryWarning() {
  const { session, sessionExpiresAt, extendSession, signOut } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!session || !sessionExpiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session, sessionExpiresAt]);

  if (!session || !sessionExpiresAt) return null;
  const remaining = sessionExpiresAt - now;
  const open = remaining > 0 && remaining <= WARNING_MS;

  return (
    <Dialog open={open} onOpenChange={() => { /* controlled by timer */ }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sua sessão vai expirar</DialogTitle>
          <DialogDescription>
            Por segurança, você será desconectado em{" "}
            <span className="font-mono text-primary">{formatRemaining(remaining)}</span>.
            Deseja continuar conectado?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            Sair agora
          </Button>
          <Button onClick={extendSession}>Continuar conectado</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}