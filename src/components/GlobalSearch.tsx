import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Users, Ticket as TicketIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ClienteHit = { kind: "cliente"; id: string; nome: string; documento: string | null; ip: string | null };
type ChamadoHit = { kind: "chamado"; id: string; numero: number; codigo: string | null; titulo: string; cliente_nome: string | null };
type Hit = ClienteHit | ChamadoHit;

export function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global: "/" foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (!typing && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fecha quando clica fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Busca com debounce
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const asNum = Number(term.replace(/\D/g, ""));
      const chamadosFilter = Number.isFinite(asNum) && asNum > 0
        ? `titulo.ilike.${like},codigo.ilike.${like},descricao.ilike.${like},numero.eq.${asNum}`
        : `titulo.ilike.${like},codigo.ilike.${like},descricao.ilike.${like}`;

      const [cliRes, chRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, documento, ip")
          .or(`nome.ilike.${like},documento.ilike.${like},ip.ilike.${like},email.ilike.${like},telefone.ilike.${like}`)
          .order("nome")
          .limit(6),
        supabase
          .from("chamados")
          .select("id, numero, codigo, titulo, clientes(nome)")
          .or(chamadosFilter)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const clientes: Hit[] = (cliRes.data ?? []).map((c) => ({
        kind: "cliente",
        id: c.id as string,
        nome: c.nome as string,
        documento: (c.documento as string | null) ?? null,
        ip: (c.ip as string | null) ?? null,
      }));
      const chamados: Hit[] = (chRes.data ?? []).map((c) => {
        const cli = (c as unknown as { clientes: { nome: string } | null }).clientes;
        return {
          kind: "chamado",
          id: c.id as string,
          numero: c.numero as number,
          codigo: (c.codigo as string | null) ?? null,
          titulo: c.titulo as string,
          cliente_nome: cli?.nome ?? null,
        };
      });
      setHits([...clientes, ...chamados]);
      setActiveIdx(0);
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const goTo = (hit: Hit) => {
    setOpen(false);
    setQ("");
    if (hit.kind === "cliente") {
      navigate({ to: "/clientes/$id", params: { id: hit.id } });
    } else {
      if (typeof window !== "undefined") sessionStorage.setItem("chamados:open-id", hit.id);
      navigate({ to: "/chamados" });
    }
  };

  return (
    <div ref={rootRef} className="relative flex-1 max-w-3xl">
      <div className="relative group">
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-primary/40 via-primary/10 to-primary/40 opacity-60 blur-sm group-focus-within:opacity-100 transition-opacity pointer-events-none" />
        <Search className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none z-10" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { if (q.trim().length >= 2) setOpen(true); }}
          onKeyDown={(e) => {
            if (!open || hits.length === 0) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, hits.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); goTo(hits[activeIdx]); }
          }}
          placeholder="Buscar cliente, chamado, IP, código…"
          className="relative w-full bg-background/80 border border-border rounded-xl pl-12 pr-20 py-3 text-base font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary shadow-[0_0_0_1px_transparent] focus:shadow-[0_0_30px_-8px_var(--primary)] transition-shadow"
        />
        <kbd className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-muted-foreground border border-border rounded-md px-2 py-1 bg-card z-10">
          /
        </kbd>
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1 bg-card border border-border shadow-xl z-50 max-h-[420px] overflow-auto">
          {loading && (
            <div className="flex items-center gap-2 p-3 text-xs font-mono text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div className="p-3 text-xs font-mono text-muted-foreground">Nenhum resultado.</div>
          )}
          {!loading && hits.length > 0 && (
            <ul className="divide-y divide-border">
              {hits.map((h, i) => {
                const active = i === activeIdx;
                return (
                  <li key={`${h.kind}-${h.id}`}>
                    <button
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => goTo(h)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 text-xs font-mono ${active ? "bg-secondary/60" : "hover:bg-secondary/40"}`}
                    >
                      {h.kind === "cliente" ? (
                        <>
                          <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-foreground">{h.nome}</div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {[h.documento, h.ip].filter(Boolean).join(" · ") || "Cliente"}
                            </div>
                          </div>
                          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Cliente</span>
                        </>
                      ) : (
                        <>
                          <TicketIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-foreground">{h.titulo}</div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {h.codigo ?? `#TK-${String(h.numero).padStart(4, "0")}`}
                              {h.cliente_nome ? ` · ${h.cliente_nome}` : ""}
                            </div>
                          </div>
                          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Chamado</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}