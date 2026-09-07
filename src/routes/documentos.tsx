import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { requireAuth } from "@/lib/guard";
import { useAuth } from "@/lib/auth";
import {
  listarDocumentos,
  gerarUrlAssinada,
  excluirDocumento,
  type DocumentoGerado,
  type DocumentoTipo,
} from "@/lib/documentos";
import { Download, Trash2, FileText, Network, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listAssignableOperators } from "@/lib/operators.functions";

export const Route = createFileRoute("/documentos")({
  beforeLoad: requireAuth,
  component: DocumentosPage,
});

function DocumentosPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<DocumentoTipo>("rfo");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocumentoGerado[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchOperadores = useServerFn(listAssignableOperators);
  const [opMap, setOpMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchOperadores();
        const m = new Map<string, string>();
        for (const u of list as unknown as Array<{ email: string; name: string | null }>) {
          if (u.email) m.set(u.email.toLowerCase(), u.name?.trim() || u.email);
        }
        setOpMap(m);
      } catch {
        /* ignore */
      }
    })();
  }, [fetchOperadores]);
  const nameOf = (email?: string | null) =>
    !email ? "—" : (opMap.get(email.toLowerCase()) ?? email);

  const load = async (t: DocumentoTipo) => {
    setLoading(true);
    try {
      setDocs(await listarDocumentos(t));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.titulo.toLowerCase().includes(q) ||
        (d.autor_email ?? "").toLowerCase().includes(q) ||
        nameOf(d.autor_email).toLowerCase().includes(q),
    );
  }, [docs, busca, opMap]);

  const baixar = async (d: DocumentoGerado) => {
    if (!d.storage_path) return toast.error("Arquivo não disponível");
    setDownloadingId(d.id);
    try {
      const url = await gerarUrlAssinada(d.storage_path, 60);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = `${d.titulo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar");
    } finally {
      setDownloadingId(null);
    }
  };

  const excluir = async (d: DocumentoGerado) => {
    if (!confirm(`Excluir "${d.titulo}"?`)) return;
    try {
      await excluirDocumento(d);
      toast.success("Excluído");
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  return (
    <AppShell title="Documentos Gerados">
      <div className="max-w-6xl">
        <div className="flex items-center gap-2 mb-4 border-b border-border">
          <TabBtn active={tab === "rfo"} onClick={() => setTab("rfo")} icon={<FileText className="h-4 w-4" />}>
            RFOs Gerados
          </TabBtn>
          <TabBtn active={tab === "transito"} onClick={() => setTab("transito")} icon={<Network className="h-4 w-4" />}>
            Trânsitos VTAL
          </TabBtn>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título ou autor…"
              className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "documento" : "documentos"}
          </span>
        </div>

        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="p-3 font-mono">DATA</th>
                <th className="p-3 font-mono">TÍTULO</th>
                <th className="p-3 font-mono">AUTOR</th>
                <th className="p-3 font-mono text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground font-mono">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground font-mono">
                    Nenhum documento {tab === "rfo" ? "RFO" : "de trânsito"} gerado ainda.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-secondary/30">
                    <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3">{d.titulo}</td>
                    <td className="p-3 font-mono text-muted-foreground">{nameOf(d.autor_email)}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => baixar(d)}
                          disabled={downloadingId === d.id}
                          className="p-2 border border-border hover:bg-secondary/70 transition-colors disabled:opacity-50"
                          title="Baixar PDF"
                        >
                          {downloadingId === d.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => excluir(d)}
                            className="p-2 border border-border hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}